"""Query the CustomerSupport agent's AgentCore Memory (short-term events and long-term records).

Usage:
    python tools/memory_query.py list                                     # what's in memory, at a glance
    python tools/memory_query.py actors
    python tools/memory_query.py sessions --actor-id cli-user
    python tools/memory_query.py events --actor-id cli-user --session-id cli-session-...
    python tools/memory_query.py records --namespace /users/cli-user/facts
    python tools/memory_query.py records --path /summaries/cli-user        # everything under a prefix
    python tools/memory_query.py search "refund preferences" --path /users/cli-user
    python tools/memory_query.py record <memoryRecordId>
    python tools/memory_query.py dump --actor-id cli-user                 # all long-term records for an actor

Add --json to any command to print the raw API response items.
"""

import argparse
import json
import os

import boto3
from botocore.exceptions import ClientError

DEFAULT_MEMORY_ID = "CustomerSupport_default_agentMemory-0Rq8bL3hdV"

# Long-term namespaces written by the strategies in agentcore/agentcore.json
ACTOR_NAMESPACES = ["/users/{actor}/facts", "/users/{actor}/preferences", "/summaries/{actor}", "/episodes/{actor}"]


def paginate(client, operation: str, key: str, **params) -> list[dict]:
    items = []
    for page in client.get_paginator(operation).paginate(**params):
        items.extend(page.get(key, []))
    return items


def print_json(items) -> None:
    print(json.dumps(items, indent=2, default=str))


def event_text(event: dict) -> str:
    parts = []
    for item in event.get("payload", []):
        if "conversational" in item:
            conv = item["conversational"]
            text = conv.get("content", {}).get("text", "")
            # The Strands session manager stores each message as a JSON envelope; show just its content blocks
            try:
                blocks = json.loads(text)["message"]["content"]
                text = " | ".join(b["text"] if "text" in b else json.dumps(b, default=str)[:200] for b in blocks)
            except (ValueError, KeyError, TypeError):
                pass
            parts.append(f"{conv.get('role', '?')}: {text}")
        elif "blob" in item:
            parts.append(f"blob: {json.dumps(item['blob'], default=str)[:200]}")
    return "\n    ".join(parts)


def print_records(records: list[dict]) -> None:
    if not records:
        print("(no records)")
    for r in records:
        score = f"  score={r['score']:.3f}" if "score" in r else ""
        print(f"[{r['memoryRecordId']}] {r.get('createdAt')}  {', '.join(r.get('namespaces', []))}{score}")
        print(f"    {r.get('content', {}).get('text', '')}\n")


def namespace_args(args) -> dict:
    if args.namespace:
        return {"namespace": args.namespace}
    if args.path:
        return {"namespacePath": args.path}
    raise SystemExit("one of --namespace or --path is required")


def cmd_actors(client, args):
    actors = paginate(client, "list_actors", "actorSummaries", memoryId=args.memory_id)
    if args.json:
        return print_json(actors)
    for a in actors:
        print(a["actorId"])


def cmd_sessions(client, args):
    sessions = paginate(client, "list_sessions", "sessionSummaries", memoryId=args.memory_id, actorId=args.actor_id)
    if args.json:
        return print_json(sessions)
    for s in sorted(sessions, key=lambda s: s["createdAt"]):
        print(f"{s['createdAt']}  {s['sessionId']}")


def cmd_events(client, args):
    events = paginate(
        client, "list_events", "events",
        memoryId=args.memory_id, actorId=args.actor_id, sessionId=args.session_id, includePayloads=True,
    )
    if args.json:
        return print_json(events)
    for e in sorted(events, key=lambda e: e["eventTimestamp"]):
        print(f"{e['eventTimestamp']}  {e['eventId']}\n    {event_text(e)}\n")


def cmd_records(client, args):
    params = {"memoryId": args.memory_id, **namespace_args(args)}
    if args.strategy_id:
        params["memoryStrategyId"] = args.strategy_id
    records = paginate(client, "list_memory_records", "memoryRecordSummaries", **params)
    print_json(records) if args.json else print_records(records)


def cmd_search(client, args):
    criteria = {"searchQuery": args.query, "topK": args.top_k}
    if args.strategy_id:
        criteria["memoryStrategyId"] = args.strategy_id
    response = client.retrieve_memory_records(
        memoryId=args.memory_id, searchCriteria=criteria, **namespace_args(args),
    )
    records = response.get("memoryRecordSummaries", [])
    print_json(records) if args.json else print_records(records)


def cmd_record(client, args):
    record = client.get_memory_record(memoryId=args.memory_id, memoryRecordId=args.record_id)["memoryRecord"]
    print_json(record) if args.json else print_records([record])


def cmd_dump(client, args):
    for template in ACTOR_NAMESPACES:
        path = template.format(actor=args.actor_id)
        records = paginate(
            client, "list_memory_records", "memoryRecordSummaries", memoryId=args.memory_id, namespacePath=path,
        )
        print(f"=== {path} ({len(records)}) ===")
        print_json(records) if args.json else print_records(records)


def cmd_list(client, args):
    memory = boto3.client("bedrock-agentcore-control", region_name=args.region).get_memory(memoryId=args.memory_id)["memory"]
    actors = paginate(client, "list_actors", "actorSummaries", memoryId=args.memory_id)
    sessions = {
        a["actorId"]: paginate(client, "list_sessions", "sessionSummaries", memoryId=args.memory_id, actorId=a["actorId"])
        for a in actors
    }
    records = paginate(client, "list_memory_records", "memoryRecordSummaries", memoryId=args.memory_id, namespacePath="/")
    by_namespace = {}
    for r in records:
        for ns in r.get("namespaces", []):
            by_namespace[ns] = by_namespace.get(ns, 0) + 1

    if args.json:
        return print_json({
            "memory": memory,
            "sessions": {actor: [s["sessionId"] for s in items] for actor, items in sessions.items()},
            "recordsByNamespace": by_namespace,
        })

    print(f"Memory {memory['id']}  status={memory['status']}  eventExpiry={memory.get('eventExpiryDuration')}d")
    print("\nStrategies:")
    for s in memory.get("strategies", []):
        print(f"  {s['type']:<16} {s['strategyId']:<40} {', '.join(s.get('namespaces', []))}")
    print(f"\nShort-term: {len(actors)} actors, {sum(len(v) for v in sessions.values())} sessions")
    for actor, items in sessions.items():
        print(f"  {actor:<24} {len(items)} sessions")
    print(f"\nLong-term: {len(records)} records")
    for ns, count in sorted(by_namespace.items()):
        print(f"  {ns:<70} {count}")


def main():
    parser = argparse.ArgumentParser(description="Query AgentCore Memory")
    parser.add_argument("--memory-id", default=os.getenv("MEMORY_AGENTMEMORY_ID", DEFAULT_MEMORY_ID))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "us-west-2"))
    parser.add_argument("--json", action="store_true", help="print raw API items")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="summarize everything in memory: strategies, actors, sessions, record counts")
    sub.add_parser("actors", help="list actors with events")

    p = sub.add_parser("sessions", help="list sessions for an actor")
    p.add_argument("--actor-id", required=True)

    p = sub.add_parser("events", help="list short-term events (conversation turns) in a session")
    p.add_argument("--actor-id", required=True)
    p.add_argument("--session-id", required=True)

    for name, help_text in [("records", "list long-term records"), ("search", "semantic search over records")]:
        p = sub.add_parser(name, help=help_text)
        if name == "search":
            p.add_argument("query")
            p.add_argument("--top-k", type=int, default=10)
        group = p.add_mutually_exclusive_group(required=True)
        group.add_argument("--namespace", help="exact namespace, e.g. /users/cli-user/facts")
        group.add_argument("--path", help="namespace prefix, e.g. /users/cli-user")
        p.add_argument("--strategy-id", help="restrict to one memory strategy")

    p = sub.add_parser("record", help="get a single long-term record")
    p.add_argument("record_id")

    p = sub.add_parser("dump", help="list all long-term records for an actor")
    p.add_argument("--actor-id", required=True)

    args = parser.parse_args()
    client = boto3.client("bedrock-agentcore", region_name=args.region)
    commands = {
        "list": cmd_list, "actors": cmd_actors, "sessions": cmd_sessions, "events": cmd_events, "records": cmd_records,
        "search": cmd_search, "record": cmd_record, "dump": cmd_dump,
    }
    try:
        commands[args.command](client, args)
    except ClientError as e:
        raise SystemExit(f"[aws error] {e}")


if __name__ == "__main__":
    main()
