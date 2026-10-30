"""Interactive console chat with the deployed CustomerSupport agent.

Usage:
    AWS_ACCOUNT_ID=123456789012 python tools/chat.py [--actor-id customer-42] [--runtime-arn ARN] [--region us-west-2]

Type a message and press Enter; the agent's reply streams to the console.
Commands: /new starts a new session, /quit (or Ctrl-D) exits.
"""

import argparse
import json
import os
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

RUNTIME_ID = "CustomerSupport_default_agent-ThZk5l7qcu"


def default_runtime_arn(region: str) -> str | None:
    """The deployed runtime's ARN, built from AWS_ACCOUNT_ID so the account number isn't in the code."""
    if os.getenv("AGENT_RUNTIME_ARN"):
        return os.getenv("AGENT_RUNTIME_ARN")
    if os.getenv("AWS_ACCOUNT_ID"):
        return f"arn:aws:bedrock-agentcore:{region}:{os.environ['AWS_ACCOUNT_ID']}:runtime/{RUNTIME_ID}"
    return None


def new_session_id() -> str:
    # Runtime session IDs must be at least 33 characters
    return f"cli-session-{uuid.uuid4()}"


def invoke(client, runtime_arn: str, session_id: str, payload: dict) -> list[dict]:
    """Send one request, print streamed text as it arrives, and return any pending approvals."""
    response = client.invoke_agent_runtime(
        agentRuntimeArn=runtime_arn,
        runtimeSessionId=session_id,
        payload=json.dumps(payload).encode(),
        contentType="application/json",
        accept="text/event-stream",
    )

    interrupts = []
    for line in response["response"].iter_lines():
        line = line.decode("utf-8")
        if not line.startswith("data: "):
            continue
        try:
            event = json.loads(line[len("data: "):])
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue

        text = event.get("event", {}).get("contentBlockDelta", {}).get("delta", {}).get("text")
        if text:
            print(text, end="", flush=True)
        interrupts.extend(event.get("interrupts", []))
        if "error" in event:
            print(f"\n[error] {event['error']}", end="")
    print()
    return interrupts


def ask_for_approvals(interrupts: list[dict]) -> list[dict]:
    """Ask the human reviewer to approve or reject each paused refund."""
    responses = []
    for interrupt in interrupts:
        reason = interrupt.get("reason") or {}
        print(f"\n[approval needed] {reason.get('message', interrupt.get('name'))}")
        print(f"  order: {reason.get('order_id')}  amount: ${reason.get('amount')}  reason: {reason.get('reason')}")
        decision = input("  Approve? [y/N]: ").strip().lower()
        if decision == "y":
            approver = input("  Approver name: ").strip()
            response = {"approved": bool(approver), "approver": approver}
        else:
            response = {"approved": False}
        responses.append({"interruptId": interrupt["id"], "response": response})
    return responses


def main():
    parser = argparse.ArgumentParser(description="Chat with the CustomerSupport agent")
    parser.add_argument("--runtime-arn", help="defaults to $AGENT_RUNTIME_ARN, else built from $AWS_ACCOUNT_ID")
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "us-west-2"))
    parser.add_argument("--actor-id", default="cli-user", help="end-user ID used to scope agent memory")
    args = parser.parse_args()
    args.runtime_arn = args.runtime_arn or default_runtime_arn(args.region)
    if not args.runtime_arn:
        parser.error("set AWS_ACCOUNT_ID (or AGENT_RUNTIME_ARN, or pass --runtime-arn)")

    client = boto3.client(
        "bedrock-agentcore",
        region_name=args.region,
        config=Config(read_timeout=300, retries={"max_attempts": 2}),
    )
    session_id = new_session_id()
    print(f"Session {session_id}  (/new for a new session, /quit to exit)\n")

    while True:
        try:
            prompt = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not prompt:
            continue
        if prompt == "/quit":
            break
        if prompt == "/new":
            session_id = new_session_id()
            print(f"Session {session_id}\n")
            continue

        print("agent> ", end="", flush=True)
        try:
            payload = {"prompt": prompt, "actorId": args.actor_id}
            interrupts = invoke(client, args.runtime_arn, session_id, payload)
            # A refund above $50 pauses the agent; resume it with the reviewer's decision
            while interrupts:
                payload = {"interruptResponses": ask_for_approvals(interrupts), "actorId": args.actor_id}
                print("agent> ", end="", flush=True)
                interrupts = invoke(client, args.runtime_arn, session_id, payload)
        except ClientError as e:
            print(f"\n[aws error] {e}")
        print()


if __name__ == "__main__":
    main()
