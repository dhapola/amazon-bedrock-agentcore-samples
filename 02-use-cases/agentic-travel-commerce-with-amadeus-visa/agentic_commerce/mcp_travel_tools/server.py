"""
Travel Tools MCP Server

Exposes raw travel-related tools via MCP protocol.
No agent logic - just pure tool implementations.
"""

import os
import logging
import boto3
from typing import Optional
from mcp.server import FastMCP

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
REGION = os.getenv("AWS_REGION")
if not REGION:
    raise ValueError("AWS_REGION environment variable is required")

# Initialize AWS clients
ssm_client = boto3.client("ssm", region_name=REGION)

# Create MCP server
mcp = FastMCP(
    "Travel Tools", host="0.0.0.0", stateless_http=True
)  # nosec B104:standard pattern for containerized MCP serverss


def get_ssm_parameter(parameter_name: str) -> str | None:
    """Retrieve a parameter from SSM Parameter Store."""
    try:
        response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except Exception as e:
        logger.warning(f"Could not retrieve SSM parameter {parameter_name}: {e}")
        return None


def load_api_keys():
    """Load API keys from SSM and set as environment variables."""
    ssm_prefix = os.getenv("SSM_PREFIX", "/agentic-commerce")
    keys = {
        "OPENWEATHER_API_KEY": f"{ssm_prefix}/travel/openweather-api-key",
        "GOOGLE_MAPS_KEY": f"{ssm_prefix}/travel/google-maps-key",
        "AMADEUS_API_KEY": f"{ssm_prefix}/travel/amadeus-public",
        "AMADEUS_API_SECRET": f"{ssm_prefix}/travel/amadeus-secret",
    }

    for env_var, ssm_param in keys.items():
        if not os.getenv(env_var):
            value = get_ssm_parameter(ssm_param)
            if value:
                os.environ[env_var] = value
                logger.info(f"✓ Loaded {env_var} from SSM")
            else:
                logger.warning(f"⚠️  {env_var} not configured")


# Load API keys before importing tools
load_api_keys()

# Import tools after API keys are loaded
from tools import (  # noqa: E402
   
    google_places_search,
    amadeus_flight_search,
    amadeus_hotel_search,
)




@mcp.tool()
def travel_places_search(query: str) -> dict:
    """
    Search for places, restaurants, and attractions using Google Places.

    Args:
        query: Search query (e.g., "best sushi restaurants in Tokyo",
               "museums near Eiffel Tower", "coffee shops in Seattle")

    Returns:
        Places with names, addresses, ratings, and Google Maps links.
    """
    return google_places_search(query)


@mcp.tool()
def travel_flight_search(
    departure_id: str,
    arrival_id: str,
    outbound_date: str,
    return_date: Optional[str] = None,
    adults: int = 1,
    max_results: int = 10,
    currency: str = "INR",
) -> str:
    """
    Search for flights between two airports using Amadeus.

    Args:
        departure_id: Departure airport IATA code (e.g., "JFK", "LAX", "DCA")
        arrival_id: Arrival airport IATA code (e.g., "LHR", "CDG", "SFO")
        outbound_date: Outbound flight date in YYYY-MM-DD format (e.g., "2025-12-20")
        return_date: Return flight date in YYYY-MM-DD format (optional, omit for one-way)
        adults: Number of adult passengers (default: 1)
        max_results: Maximum number of flight offers to return (default: 10)
        currency: Currency code (default: "INR")

    Returns:
        Formatted flight results with prices, durations, stops, and cabin class.
    """
    return amadeus_flight_search(departure_id, arrival_id, outbound_date, return_date, adults, max_results, currency)


@mcp.tool()
def travel_hotel_search(
    city_iata_code: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 1,
    rooms: int = 1,
    max_results: int = 10,
    currency: str = "INR",
    ratings: Optional[str] = None,
) -> str:
    """
    Search for hotel offers with availability and pricing using Amadeus.

    Args:
        city_iata_code: City IATA code (e.g., "DEL" for Delhi, "BOM" for Mumbai, "NYC" for New York)
        check_in_date: Check-in date in YYYY-MM-DD format (e.g., "2026-06-15")
        check_out_date: Check-out date in YYYY-MM-DD format (e.g., "2026-06-20")
        adults: Number of adult guests (default: 1)
        rooms: Number of rooms (default: 1)
        max_results: Maximum number of hotel offers to return (default: 10)
        currency: Currency code (default: "INR")
        ratings: Hotel star ratings filter, comma-separated (e.g., "4,5" for 4 and 5-star hotels)

    Returns:
        Formatted hotel results with availability, pricing, room details, and cancellation policies.
    """
    return amadeus_hotel_search(city_code, check_in_date, check_out_date, adults, rooms, max_results, currency, ratings)


# =============================================================================
# SERVER STARTUP
# =============================================================================

if __name__ == "__main__":
    logger.info("Starting Travel Tools MCP Server...")
    mcp.run(transport="streamable-http")
