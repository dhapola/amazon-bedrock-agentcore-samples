import os
from functools import lru_cache

from strands import Agent, tool
from strands.agent.conversation_manager.null_conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from parse import parse_payload
from memory.session import get_memory_session_manager
from gateway.client import get_refunds_gateway_client
from gateway.approval import RefundApprovalHook
from policies.loader import sync_policies_from_s3

DEFAULT_SYSTEM_PROMPT = "You are a helpful customer support assistant. Use tools when appropriate."

# Define a collection of tools used by the model
tools = []

# Define a simple function tool
@tool
def add_numbers(a: int, b: int) -> int:
    """Return the sum of two numbers"""
    return a + b

tools.append(add_numbers)

# Refund tools served by the AgentCore Gateway (absent in local dev unless the URL is set)
refunds_gateway = get_refunds_gateway_client()
if refunds_gateway is not None:
    tools.append(refunds_gateway)

def _make_conversation_manager():
    return NullConversationManager()

@lru_cache(maxsize=128)
def _get_agent(session_id: str, actor_id: str) -> Agent:
    """Given a session_id and actor_id, return or construct the corresponding Strands agent.
    Note: caching helps avoid repeated identity fetches on non-bedrock model loads
    and supports in-memory session management for local dev."""
    return Agent(
        model=load_model(),
        session_manager=get_memory_session_manager(session_id, actor_id),
        conversation_manager=_make_conversation_manager(),
        system_prompt=DEFAULT_SYSTEM_PROMPT,
        tools=tools,
        hooks=[RefundApprovalHook()],
    )

def create_app():
    app = BedrockAgentCoreApp()
    log = app.logger

    @app.entrypoint
    async def invoke(payload, context):
        log.info("Invoking Agent.....")

        session_id = getattr(context, "session_id", None) or "default-session"
        prompt, actor_id = parse_payload(payload)

        log.info(f"Invoking with session_id={session_id} and actor_id={actor_id}")
        agent = _get_agent(session_id, actor_id)

        async for event in agent.stream_async(prompt):
            if not isinstance(event, dict):
                continue
            result = event.get("result")
            if result is not None and result.stop_reason == "interrupt":
                # Surface pending approvals; the caller resumes with `interruptResponses`
                yield {"interrupts": [{"id": i.id, "name": i.name, "reason": i.reason} for i in result.interrupts]}
                continue
            if "event" not in event:
                continue
            cbs = event["event"].get("contentBlockStart")
            if cbs is not None and not cbs.get("start"):
                continue
            yield event

    return app

app = create_app()

# Set on the deployed runtime from envVars in agentcore/agentcore.json
CEDAR_POLICIES_BUCKET = os.getenv("CEDAR_POLICIES_BUCKET", "d2-agentcore-cedar-policies")

def load_policies_and_run_agent():
    # Apply the Cedar policies in the bucket to the gateway's policy engine before serving. On
    # failure keep serving: the engine retains its last policies and denies by default.
    try:
        sync_policies_from_s3(bucket=CEDAR_POLICIES_BUCKET)
    except Exception:
        app.logger.exception("failed to sync Cedar policies from S3; serving with the engine's current policies")

    app.run()

if __name__ == "__main__":
    load_policies_and_run_agent()
