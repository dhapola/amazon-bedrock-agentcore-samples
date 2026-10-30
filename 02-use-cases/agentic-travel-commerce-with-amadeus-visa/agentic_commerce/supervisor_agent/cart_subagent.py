"""
Cart Subagent

A subagent that handles cart and payment operations by connecting to cart tools
via the gateway. Exposed as a tool for the main supervisor agent.
"""

import os
import logging
from strands import Agent, tool
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient

from gateway_client import get_gateway_client
from prompt_manager import date_readable

logger = logging.getLogger(__name__)

REGION = os.getenv("AWS_REGION")
if not REGION:
    raise EnvironmentError(
        "AWS_REGION environment variable is required but not set. "
        "This should be configured by the CDK deployment."
    )

# =============================================================================
# CART AGENT SYSTEM PROMPT
# =============================================================================

CART_AGENT_PROMPT = f"""
You are a shopping cart assistant for a travel commerce app. Today's date is {date_readable}.

CART OPERATIONS:
- Always call get_cart() BEFORE adding items to prevent duplicates
- Compare identifiers: ASIN (products), flight_id+origin+destination+date (flights), hotel_id+city_code (hotels)
- If item already exists, tell the user — do not add duplicates
- After adding, call get_cart() to verify success
- Set item_type correctly: "hotel", "flight", or "product"
- Complete the entire request before responding (e.g., round trip = both flights, multiple nights = all nights)

HOTEL CART FORMAT (all 4 fields required):
- title (str): Hotel name
- price (str): e.g., "$150/night"
- hotel_id (str): Unique identifier from search results
- city_code (str): City/location code
- Never use placeholder values — use actual data from search results

PURCHASE FLOW:
Step 1 — When user wants to buy/checkout:
  * Call check_user_has_payment_card() FIRST
  * If NO card: Say "You don't have a payment card on file yet. Please click the button below to add a card securely." Then STOP.
  * If HAS card: Call request_purchase_confirmation(), summarize totals (e.g., $800/night × 3 = $2,400), present to user

Step 2 — Only after explicit user confirmation:
  * Call confirm_purchase()
  * Confirm with: Order ID, total charged, item count

CARD SECURITY — NEVER ask for card number, CVV, expiration, or any card details in chat. The UI handles card entry securely.

UI ACTIONS:
- Include ui_actions when contextually appropriate:
  * ADD_CARD: {{"type": "show_button", "action": "ADD_CARD", "label": "💳 Add Payment Card"}}
  * CONFIRM_PURCHASE: {{"type": "show_button", "action": "CONFIRM_PURCHASE", "label": "Confirm Purchase"}}

Use the provided tools. Never use placeholder or mock data. Think step by step.
"""


# =============================================================================
# GATEWAY CLIENT FOR CART TOOLS
# =============================================================================


def get_cart_tools_client() -> MCPClient:
    """Get MCPClient filtered for cart tools only."""
    return get_gateway_client("^carttools___")


# =============================================================================
# BEDROCK MODEL
# =============================================================================

bedrock_model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    region_name=REGION,
    temperature=0.1,
)


# =============================================================================
# CART SUBAGENT TOOL
# =============================================================================


@tool
async def cart_manager(query: str, user_id: str = "", session_id: str = ""):
    """
    Process shopping cart and payment operations.

    AVAILABLE TOOLS:
    - get_cart: View cart contents (user_id)
    - add_to_cart: Add products (user_id, items list with asin/title/price)
    - add_hotel_to_cart: Add hotels (user_id, hotels list with title/price/hotel_id/city_code)
    - add_flight_to_cart: Add flights (user_id, flights list with title/price/flight_id/origin/destination/departure_date)
    - remove_from_cart: Remove items (user_id, identifiers list, item_type: product/hotel/flight)
    - clear_cart: Empty cart (user_id)
    - check_user_has_payment_card: Verify payment method (user_id)
    - request_purchase_confirmation: Pre-checkout summary (user_id)
    - confirm_purchase: Execute purchase after confirmation (user_id)
    - onboard_card: Add payment card (user_id, card details)
    - get_visa_iframe_config: Get secure card entry config (user_id)

    ROUTE HERE FOR:
    - View cart: "What's in my cart?", "Show my cart"
    - Add items: "Add this hotel to cart", "Add the flight"
    - Remove items: "Remove the hotel", "Take out the flight"
    - Clear cart: "Empty my cart", "Clear everything"
    - Checkout: "Buy these items", "Checkout", "Purchase"
    - Payment: "Add a payment card", "Setup payment method"

    Args:
        query: The cart/payment request.
        user_id: User identifier (REQUIRED for all cart operations).
        session_id: Session identifier for context.

    Returns:
        Cart operation result or payment status.
    """
    try:
        logger.info(f"Cart subagent (async) processing: {query[:100]}...")

        prompt_with_context = f"""{CART_AGENT_PROMPT}

        CRITICAL: You are currently serving user_id: {user_id}

        EVERY tool call MUST include user_id as the first parameter.
        Example tool calls:
        - get_cart(user_id="{user_id}")
        - clear_cart(user_id="{user_id}")
        - add_to_cart(user_id="{user_id}", items=[{{"asin": "123", "title": "Product", "price": "$10", "item_type": "product"}}])
        - add_to_cart(user_id="{user_id}", items=[{{"asin": "", "title": "Hotel Name", "price": "$100", "item_type": "hotel", "hotel_id": "h123", "city_code": "NYC"}}])
        - remove_from_cart(user_id="{user_id}", identifiers=[...], item_type="product")

        DO NOT ask the user for their user_id - you already have it: {user_id}"""

        cart_client = get_cart_tools_client()

        agent = Agent(
            name="cart_agent",
            model=bedrock_model,
            tools=[cart_client],
            system_prompt=prompt_with_context,
            trace_attributes={
                "user.id": user_id,
                "session.id": session_id,
                "agent.type": "cart_subagent",
            },
        )

        result = ""
        async for event in agent.stream_async(query):
            if "data" in event:
                yield {"data": event["data"]}
            if "current_tool_use" in event:
                yield {"current_tool_use": event["current_tool_use"]}
            if "result" in event:
                result = str(event["result"])

        yield {"result": result}

    except Exception as e:
        logger.error(f"Cart subagent async error: {e}", exc_info=True)
        yield {"error": str(e)}
