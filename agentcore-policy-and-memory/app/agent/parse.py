from typing import Any

def _strip_trailing_tool_use(messages: Any) -> list[dict]:
    """Strip toolUse blocks from the tail until the last message has none."""
    if not isinstance(messages, list):
        raise ValueError("messages must be a list")

    messages = list(messages)
    while messages:
        last = messages[-1]
        if not isinstance(last, dict):
            raise ValueError("each message must be an object")
        original_content = last.get("content", [])
        if not isinstance(original_content, list) or not all(isinstance(block, dict) for block in original_content):
            raise ValueError("each message content value must be a list of content blocks")

        content = [block for block in original_content if "toolUse" not in block]
        if len(content) == len(original_content):
            break
        if content:
            messages[-1] = {**last, "content": content}
            break
        messages.pop()

    return messages

def _interrupt_responses(responses: Any) -> list[dict]:
    """Convert [{"interruptId": ..., "response": ...}] into Strands interrupt response blocks."""
    if not isinstance(responses, list) or not responses:
        raise ValueError("interruptResponses must be a non-empty list")
    blocks = []
    for item in responses:
        if not isinstance(item, dict) or not isinstance(item.get("interruptId"), str) or "response" not in item:
            raise ValueError("each interrupt response needs a string interruptId and a response")
        blocks.append({"interruptResponse": {"interruptId": item["interruptId"], "response": item["response"]}})
    return blocks

def parse_payload(payload: dict):
    """Accept a caller-supplied message history or a plain prompt string."""
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")
    actor_id = payload.get("actorId", "default")
    if not isinstance(actor_id, str):
        raise ValueError("actorId must be a string")
    if not actor_id:
        actor_id = "default"
    if "interruptResponses" in payload:
        return _interrupt_responses(payload["interruptResponses"]), actor_id
    if "messages" in payload:
        return _strip_trailing_tool_use(payload["messages"]), actor_id
    prompt = payload.get("prompt", "")
    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string")
    return prompt, actor_id
