"""
Travel Subagent

A subagent that handles travel-related queries by connecting to travel tools
via the gateway. Exposed as a tool for the main supervisor agent.
"""

import os
import logging
from strands import Agent, tool
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient

from gateway_client import get_gateway_client
from prompt_manager import get_prompt

logger = logging.getLogger(__name__)

REGION = os.getenv("AWS_REGION")
if not REGION:
    raise EnvironmentError(
        "AWS_REGION environment variable is required but not set. "
        "This should be configured by the CDK deployment."
    )

# =============================================================================
# TRAVEL AGENT SYSTEM PROMPT
# =============================================================================

TRAVEL_AGENT_PROMPT = get_prompt("hotel_flight_search")


# =============================================================================
# GATEWAY CLIENT FOR TRAVEL TOOLS
# =============================================================================


def get_travel_tools_client() -> MCPClient:
    """Get MCPClient filtered for travel tools only."""
    return get_gateway_client("^traveltools___")


# =============================================================================
# BEDROCK MODEL
# =============================================================================

bedrock_model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region_name=REGION,
    temperature=0.2,
)


# =============================================================================
# TRAVEL SUBAGENT TOOL
# =============================================================================


@tool
async def travel_assistant(query: str, user_id: str = "", session_id: str = ""):
    """
    Process travel planning queries using specialized travel tools.

    ROUTE HERE FOR:
    - Flight searches: "Find flights from BOS to PAR on 2025-12-20"
    - Hotel searches: "Hotels in Delhi from 2025-12-20 to 2025-12-25"
    - Restaurant/attraction searches: "Best pizza restaurants in Bangalore"
    - General travel info: "What to do in Dehradun", "Travel tips for Darjeeling"
    - Trip planning: "Plan a 3-day itinerary for Kerala"

    IMPORTANT: Include specific dates (YYYY-MM-DD format) and airport codes when available.
    For flights and hotels, use 3-letter airport aita codes (DEL, HYD, BLR, BOM, BOS, JFK, CDG, NRT, etc.).

    Args:
        query: The travel request with as much detail as possible.
        user_id: User identifier for personalization.
        session_id: Session identifier for context.

    Returns:
        Travel information, search results, or recommendations.
        Will retry searches with refined queries if initial results are insufficient.
    """
    try:
        logger.info(f"Travel subagent (async) processing: {query[:100]}...")

        travel_client = get_travel_tools_client()

        logger.info(f"Travel subagent tools: {travel_client}")

        agent = Agent(
            name="travel_agent",
            model=bedrock_model,
            tools=[travel_client],
            system_prompt=TRAVEL_AGENT_PROMPT,
            trace_attributes={
                "user.id": user_id,
                "session.id": session_id,
                "agent.type": "travel_subagent",
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
        logger.error(f"Travel subagent async error: {e}", exc_info=True)
        yield {"error": str(e)}
