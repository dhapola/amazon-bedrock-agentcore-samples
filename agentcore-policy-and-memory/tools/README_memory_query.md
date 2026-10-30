# memory_query.py

Command-line tool for inspecting what the CustomerSupport agent has stored in AgentCore Memory: short-term
conversation events and the long-term records the memory strategies extract from them. It calls the
`bedrock-agentcore` data-plane APIs through boto3 and only reads; it never writes or deletes memory.

## Setup

Run it with the agent's virtualenv (it has `boto3`) from the project root:

```bash
cd app/agent && uv sync && cd ../..
app/agent/.venv/bin/python tools/memory_query.py list
```

AWS credentials come from the usual boto3 chain (env vars, `AWS_PROFILE`, SSO, etc.).

## Global options

Put these **before** the command name (e.g. `memory_query.py --json list`):

| Option | Default | Description |
|---|---|---|
| `--memory-id` | `$MEMORY_AGENTMEMORY_ID`, else `CustomerSupport_default_agentMemory-0Rq8bL3hdV` | Memory to query |
| `--region` | `$AWS_REGION`, else `us-west-2` | Region the memory is deployed in |
| `--json` | off | Print the raw API items instead of the formatted view |

## Commands

| Command | What it shows |
|---|---|
| `list` | Everything at a glance: memory status and event expiry, strategies (type, ID, namespace template), actors with session counts, and long-term record counts per namespace |
| `actors` | Actors (end users) that have events |
| `sessions --actor-id ID` | An actor's sessions, oldest first |
| `events --actor-id ID --session-id ID` | Conversation turns in a session, including tool calls and tool results |
| `records --namespace NS` / `--path PREFIX` | Long-term records in one exact namespace, or in every namespace under a prefix. Optional `--strategy-id` |
| `search QUERY --namespace NS` / `--path PREFIX` | Semantic search over long-term records, with relevance scores. Optional `--top-k` (default 10), `--strategy-id` |
| `record RECORD_ID` | One long-term record |
| `dump --actor-id ID` | All of an actor's long-term records: facts, preferences, summaries, episodes |

## Examples

```bash
PY=app/agent/.venv/bin/python

$PY tools/memory_query.py list
$PY tools/memory_query.py sessions --actor-id cli-user
$PY tools/memory_query.py events --actor-id cli-user --session-id cli-session-bd1f0bcd-4dcf-42c2-a61b-cd36e0bd41f3
$PY tools/memory_query.py records --namespace /users/cli-user/facts
$PY tools/memory_query.py records --path /summaries/cli-user
$PY tools/memory_query.py search "refund for damaged product" --path /users/cli-user --top-k 5
$PY tools/memory_query.py record mem-f4217ec6-6f17-4152-942a-f3a943b948ac
$PY tools/memory_query.py --json dump --actor-id cli-user > cli-user-memory.json
```

## Namespaces

These come from the strategies in `agentcore/agentcore.json`:

| Strategy | Namespace |
|---|---|
| SEMANTIC | `/users/{actorId}/facts` |
| USER_PREFERENCE | `/users/{actorId}/preferences` |
| SUMMARIZATION | `/summaries/{actorId}/{sessionId}` |
| EPISODIC | `/episodes/{actorId}/{sessionId}`, reflections in `/episodes/{actorId}` |

Use `--path` with a prefix such as `/summaries/cli-user` to cover all of an actor's sessions, or `--path /` to cover every record.

## Notes

- Long-term records are extracted asynchronously, so a conversation that just happened may not show up in `records`/`search` right away. Its events show up straight away.
- Events expire after the memory's event expiry (30 days).
- The agent's Strands session manager saves each message as a JSON envelope. `events` unwraps it so you see the message text; use `--json` to see the full payload, including the session and agent-state blobs.

## IAM permissions

`bedrock-agentcore:ListActors`, `ListSessions`, `ListEvents`, `ListMemoryRecords`, `RetrieveMemoryRecords`,
`GetMemoryRecord`, plus `bedrock-agentcore:GetMemory` for `list`.
