import json
from typing import Any

from strands.hooks import AfterToolCallEvent, BeforeToolCallEvent, HookProvider, HookRegistry

REFUND_TOOL_NAME = "process-refund___process_refund"
INTERRUPT_NAME = "refund_approval"
# Error text the gateway returns when the Cedar policy engine denies a tool call
POLICY_DENIED_MARKER = "not allowed due to policy enforcement"


def _call_key(tool_input: dict) -> str:
    return json.dumps({k: v for k, v in tool_input.items() if k != "approved_by"}, sort_keys=True, default=str)


class RefundApprovalHook(HookProvider):
    """Escalate refund calls denied by the gateway's Cedar policies to a human reviewer.

    The rules for which refunds need approval live only in the Cedar policies
    (agentcore/policies/). This hook never decides that itself: it sends every call as the
    model wrote it, and only when the policy engine denies one does it pause the agent with an
    interrupt. If the reviewer approves, the call is retried once with `approved_by` set from
    their response; the model's own tool call is left untouched in the conversation history.

    Resume with response {"approved": true, "approver": "<name>"} or {"approved": false}.
    """

    def __init__(self) -> None:
        self._awaiting_review: dict[str, str] = {}  # toolUseId -> denial message
        self._escalated: set[str] = set()  # calls already reviewed once, never escalated again

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        registry.add_callback(BeforeToolCallEvent, self.before_tool_call)
        registry.add_callback(AfterToolCallEvent, self.after_tool_call)

    def before_tool_call(self, event: BeforeToolCallEvent) -> None:
        if event.tool_use["name"] != REFUND_TOOL_NAME:
            return

        # Only a human reviewer may supply approved_by; drop any value the model sent
        tool_input = {k: v for k, v in event.tool_use["input"].items() if k != "approved_by"}
        event.tool_use = {**event.tool_use, "input": tool_input}

        denial = self._awaiting_review.get(event.tool_use["toolUseId"])
        if denial is None:
            return

        response = event.interrupt(
            INTERRUPT_NAME,
            reason={
                "message": f"Refund blocked by policy and needs human approval: {denial}",
                "order_id": tool_input.get("order_id"),
                "amount": tool_input.get("amount"),
                "reason": tool_input.get("reason"),
            },
        )
        del self._awaiting_review[event.tool_use["toolUseId"]]
        self._escalated.add(_call_key(tool_input))

        approver = response.get("approver") if isinstance(response, dict) else None
        if not (isinstance(response, dict) and response.get("approved") is True and approver):
            event.cancel_tool = "A human reviewer declined this refund."
            return

        event.tool_use = {**event.tool_use, "input": {**tool_input, "approved_by": str(approver)}}

    def after_tool_call(self, event: AfterToolCallEvent) -> None:
        if event.tool_use["name"] != REFUND_TOOL_NAME:
            return

        # approved_by is only present on the retry built from a reviewer's response (model
        # values are stripped), so record the review in the result the model sees; otherwise
        # its history shows a call without approved_by succeeding and it doubts the approval.
        approver = event.tool_use["input"].get("approved_by")
        if approver:
            outcome = "and the refund was processed" if event.result.get("status") != "error" else "but the call still failed"
            note = {"text": f"Human review: this refund was approved by {approver} {outcome}."}
            event.result = {**event.result, "content": [note, *event.result.get("content", [])]}
            return

        if event.result.get("status") != "error":
            return
        text = " ".join(block.get("text", "") for block in event.result.get("content", []))
        if POLICY_DENIED_MARKER not in text or _call_key(event.tool_use["input"]) in self._escalated:
            return

        self._awaiting_review[event.tool_use["toolUseId"]] = text
        event.retry = True
