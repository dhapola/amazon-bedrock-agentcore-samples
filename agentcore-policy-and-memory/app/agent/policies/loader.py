"""Sync the gateway's Cedar policies from S3 into its AgentCore policy engine.

S3 is the only source of policies: every `<name>.cedar` object in the bucket becomes one policy,
named from the file (e.g. allow-refunds-up-to-60.cedar -> allow_refunds_up_to_60). An AgentCore
policy holds exactly one Cedar statement, so a file with several statements becomes one policy per
statement (set-refund-limit.cedar -> set_refund_limit_1, set_refund_limit_2, ...). After a sync the
engine holds exactly the S3 policies: missing ones are created, changed ones updated, and policies
whose file was removed are deleted. Runs at every runtime start, so it is idempotent and tolerates
other microVMs syncing concurrently.
"""

import logging
import os
import re
import time

import boto3

POLICY_ENGINE_ID = os.getenv("POLICY_ENGINE_ID")
REGION = os.getenv("AWS_REGION")

SETTLE_TIMEOUT_SECONDS = 60
PENDING_STATUSES = {"CREATING", "UPDATING", "DELETING"}
# A failed policy is never enforced and is not retried by the service, so the sync recreates it
FAILED_STATUSES = {"CREATE_FAILED", "UPDATE_FAILED"}

# Child of the runtime app logger so sync messages land in the runtime logs
log = logging.getLogger("bedrock_agentcore.app").getChild("policies")


def _policy_name(key: str) -> str:
    """Map an S3 key to a valid policy name: [A-Za-z][A-Za-z0-9_]{0,47}."""
    stem = key.rsplit("/", 1)[-1].removesuffix(".cedar")
    name = re.sub(r"[^A-Za-z0-9_]", "_", stem)
    if not name or not name[0].isalpha():
        name = f"p_{name}"
    return name[:48]


def _split_statements(text: str) -> list[str]:
    """Split Cedar source on the `;` that ends each statement, ignoring ones inside strings and
    `//` comments. Comments before a statement stay with it; trailing comment-only text is dropped."""
    statements, start, i, n = [], 0, 0, len(text)
    while i < n:
        if text.startswith("//", i):
            i = text.find("\n", i)
            if i == -1:
                break
        elif text[i] == '"':
            i += 1
            while i < n and text[i] != '"':
                i += 2 if text[i] == "\\" else 1
        elif text[i] == ";":
            statements.append(text[start : i + 1].strip())
            start = i + 1
        i += 1
    rest = "\n".join(line for line in text[start:].splitlines() if not line.strip().startswith("//"))
    if rest.strip():
        statements.append(text[start:].strip())  # unterminated statement: let the service reject it
    return statements


def _load_s3_policies(s3, bucket: str) -> dict[str, str]:
    policies: dict[str, str] = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            if not obj["Key"].endswith(".cedar"):
                continue
            text = s3.get_object(Bucket=bucket, Key=obj["Key"])["Body"].read().decode("utf-8")
            statements = _split_statements(text)
            name = _policy_name(obj["Key"])
            if len(statements) == 1:
                named = {name: statements[0]}
            else:
                named = {f"{name[:44]}_{i}": statement for i, statement in enumerate(statements, start=1)}
            for policy_name, statement in named.items():
                if policy_name in policies:
                    raise ValueError(f"S3 keys map to the same policy name {policy_name!r}; rename one of them")
                policies[policy_name] = statement
    return policies


def _list_engine_policies(control, engine_id: str) -> dict[str, dict]:
    policies: dict[str, dict] = {}
    for page in control.get_paginator("list_policies").paginate(policyEngineId=engine_id):
        for policy in page.get("policies", []):
            policies[policy["name"]] = policy
    return policies


def _statement(policy: dict) -> str:
    return policy.get("definition", {}).get("policy", {}).get("statement", "")


def _wait_until_deleted(control, engine_id: str, name: str) -> None:
    deadline = time.monotonic() + SETTLE_TIMEOUT_SECONDS
    while name in _list_engine_policies(control, engine_id):
        if time.monotonic() > deadline:
            raise TimeoutError(f"policy {name} was not deleted within {SETTLE_TIMEOUT_SECONDS}s")
        time.sleep(2)


def _wait_until_settled(control, engine_id: str, names: set[str]) -> set[str]:
    """Wait for changed policies to finish validating; return the ones that failed or are still pending."""
    failed: set[str] = set()
    deadline = time.monotonic() + SETTLE_TIMEOUT_SECONDS
    while names and time.monotonic() < deadline:
        current = _list_engine_policies(control, engine_id)
        pending = {n for n in names if n in current and current[n]["status"] in PENDING_STATUSES}
        for name in names - pending:
            policy = current.get(name)
            if policy is not None and policy["status"] != "ACTIVE":
                log.error("policy %s is %s: %s", name, policy["status"], policy.get("statusReasons"))
                failed.add(name)
        names = pending
        if names:
            time.sleep(2)
    if names:
        log.warning("policies still pending after %ss: %s", SETTLE_TIMEOUT_SECONDS, sorted(names))
    return failed | names


def sync_policies_from_s3(bucket: str | None, engine_id: str | None = POLICY_ENGINE_ID) -> None:
    """Make the policy engine's policies match the .cedar files in the bucket."""
    if not bucket or not engine_id:
        log.info("CEDAR_POLICIES_BUCKET or POLICY_ENGINE_ID not set; skipping policy sync")
        return

    s3 = boto3.client("s3", region_name=REGION)
    control = boto3.client("bedrock-agentcore-control", region_name=REGION)
    conflicts = (control.exceptions.ConflictException, control.exceptions.ConcurrentModificationException)

    desired = _load_s3_policies(s3, bucket)
    if not desired:
        # An empty listing is more likely a misconfiguration than an intent to revoke every permit
        log.error("no .cedar files in s3://%s; leaving the policy engine unchanged", bucket)
        return
    existing = _list_engine_policies(control, engine_id)
    changed: set[str] = set()
    rejected: set[str] = set()

    # Create and update first; deletions wait until those succeed (below)
    for name, statement in desired.items():
        definition = {"policy": {"statement": statement}}
        try:
            if name in existing and existing[name]["status"] in FAILED_STATUSES:
                control.delete_policy(policyEngineId=engine_id, policyId=existing[name]["policyId"])
                _wait_until_deleted(control, engine_id, name)
                log.info("deleted %s policy %s to recreate it", existing[name]["status"], name)
                del existing[name]
            if name not in existing:
                control.create_policy(
                    policyEngineId=engine_id,
                    name=name,
                    definition=definition,
                    description=f"Synced from s3://{bucket}",
                    validationMode="FAIL_ON_ANY_FINDINGS",
                )
                log.info("created policy %s", name)
                changed.add(name)
            elif _statement(existing[name]) != statement:
                control.update_policy(
                    policyEngineId=engine_id, policyId=existing[name]["policyId"], definition=definition
                )
                log.info("updated policy %s", name)
                changed.add(name)
        except conflicts:
            log.info("policy %s is being changed by another runtime; skipping", name)
        except control.exceptions.ValidationException as e:
            log.error("policy %s was rejected: %s", name, e)
            rejected.add(name)

    # Only delete stale policies once every new/changed one is ACTIVE, so a bad file in S3 can't
    # leave the engine without the permits it had
    failed = _wait_until_settled(control, engine_id, changed) | rejected
    if failed:
        log.error(
            "policy sync from s3://%s finished with %d failed policies %s; keeping policies removed from S3 until they succeed",
            bucket, len(failed), sorted(failed),
        )
        return

    for name, policy in existing.items():
        if name in desired:
            continue
        try:
            control.delete_policy(policyEngineId=engine_id, policyId=policy["policyId"])
            log.info("deleted policy %s (no longer in S3)", name)
        except (control.exceptions.ResourceNotFoundException, *conflicts):
            log.info("policy %s already deleted or being changed by another runtime", name)

    log.info("policy sync from s3://%s complete: %d policies", bucket, len(desired))
