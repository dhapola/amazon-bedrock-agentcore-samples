"""
Travel Tools Implementation

Pure tool functions for weather, search, flights, hotels, and places.
No agent logic - these are called directly by the MCP server.
"""

import csv
import json
import logging
import os
from datetime import datetime
from typing import Any, Optional

import requests
from rapidfuzz import process, fuzz
from amadeus import Client, ResponseError

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

REGION = os.getenv("AWS_REGION")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY")
AMADEUS_PUBLIC = os.getenv("AMADEUS_PUBLIC")
AMADEUS_SECRET = os.getenv("AMADEUS_SECRET")


# =============================================================================
# CITY DATABASE
# =============================================================================


def load_cities(filepath: str) -> list[dict[str, Any]]:
    """Load city database from CSV file."""
    cities = []
    try:
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cities.append(
                    {
                        "city": row["city"].strip(),
                        "country": row.get("country", "").strip(),
                        "latitude": float(row["lat"]),
                        "longitude": float(row["lng"]),
                        "population": row["population"],
                    }
                )
    except FileNotFoundError:
        logger.warning("City database not found at %s", filepath)
    except Exception as e:
        logger.error("Error loading city database: %s", e)
    return cities


def get_city_database() -> tuple[list[dict], list[str]]:
    """Get city database and names list."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    cities_file = os.path.join(current_dir, "worldcities.csv")
    cities = load_cities(cities_file)
    city_names = [c["city"].lower() for c in cities]
    return cities, city_names


CITIES, CITY_NAMES = get_city_database()


def match_city(
    user_input: str, top_n: int = 3, score_cutoff: int = 80
) -> list[tuple[str, dict]]:
    """Match user input to city using fuzzy matching."""
    if not CITY_NAMES:
        return []

    matches = process.extract(
        user_input.lower(), CITY_NAMES, scorer=fuzz.WRatio, limit=top_n
    )

    return [
        (match, CITIES[idx]) for match, score, idx in matches if score >= score_cutoff
    ]


# =============================================================================
# WEATHER TOOL
# =============================================================================


def call_openweather_api(lat: str, lon: str, call_type: str = "forecast") -> str | None:
    """Call OpenWeatherMap API."""
    if not OPENWEATHER_API_KEY:
        return None

    url = f"https://api.openweathermap.org/data/2.5/{call_type}"
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.content.decode()
    except requests.RequestException as e:
        logger.error("OpenWeather API error: %s", e)
        return None


def process_weather_forecast(weather_json: dict) -> list[str]:
    """Process weather data into daily summaries."""
    if not weather_json or "list" not in weather_json:
        return []

    daily_forecast = {}

    for entry in weather_json["list"]:
        try:
            dt = datetime.strptime(entry["dt_txt"], "%Y-%m-%d %H:%M:%S")
            day = dt.date()
            hour = dt.hour

            if hour == 12 and day not in daily_forecast:
                daily_forecast[day] = entry
            elif day not in daily_forecast:
                daily_forecast[day] = entry
        except (KeyError, ValueError):
            continue

    forecast_output = []
    for day in sorted(daily_forecast.keys()):
        try:
            entry = daily_forecast[day]
            desc = entry["weather"][0]["description"].title()
            temp_k = entry["main"]["temp"]
            temp_f = round((temp_k - 273.15) * 9 / 5 + 32)
            forecast_output.append(f"{day.strftime('%A, %b %d')}: {desc}, {temp_f}°F")
        except (KeyError, IndexError):
            continue

    return forecast_output


def get_weather(city: str) -> str:
    """Get 5-day weather forecast for a city."""
    logger.info("get_weather called for city=%s", city)
    if not OPENWEATHER_API_KEY:
        logger.warning("OpenWeather API key not configured")
        return "Error: OpenWeather API key not configured."

    try:
        # Match city to database
        matches = match_city(city, score_cutoff=70)

        if not matches:
            return f"Error: Could not find city '{city}' in database."

        # Use best match
        _, city_data = matches[0]
        lat = str(city_data["latitude"])
        lon = str(city_data["longitude"])
        matched_city = city_data["city"]
        country = city_data["country"]

        # Call API
        weather_raw = call_openweather_api(lat, lon, "forecast")
        if not weather_raw:
            return "Error: Could not retrieve weather data."

        weather_json = json.loads(weather_raw)
        forecast_lines = process_weather_forecast(weather_json)

        if not forecast_lines:
            return "Error: No forecast data available."

        header = f"5-Day Forecast for {matched_city}, {country}:\n"
        logger.info("get_weather returning %d forecast lines for %s", len(forecast_lines), matched_city)
        return header + "\n".join(forecast_lines)

    except Exception as e:
        logger.exception("get_weather error for city=%s", city)
        return f"Error: {str(e)}"


# =============================================================================
# AMADEUS API (Flights & Hotels)
# =============================================================================


def get_amadeus_token() -> str | None:
    """Get OAuth token for Amadeus API."""
    if not AMADEUS_PUBLIC or not AMADEUS_SECRET:
        return None

    token_url = "https://test.api.amadeus.com/v1/security/oauth2/token"

    try:
        response = requests.post(
            token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "client_credentials",
                "client_id": AMADEUS_PUBLIC,
                "client_secret": AMADEUS_SECRET,
            },
            timeout=10,
        )

        if response.status_code == 200:
            return response.json().get("access_token")
        return None

    except Exception as e:
        logger.error("Amadeus token error: %s", e)
        return None


def get_flight_offers(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    max_price: int = 400,
    currency: str = "INR",
) -> dict:
    """Search for flight offers."""
    token = get_amadeus_token()
    if not token:
        return {"error": "Amadeus API not configured or token failed."}

    try:
        response = requests.get(
            "https://test.api.amadeus.com/v2/shopping/flight-offers",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "originLocationCode": origin,
                "destinationLocationCode": destination,
                "departureDate": departure_date,
                "adults": adults,
                "currencyCode": currency,
                "maxPrice": max_price,
            },
            timeout=15,
        )

        if response.status_code == 200:
            return response.json()
        return {
            "error": f"Flight search failed: {response.status_code}",
            "details": response.text,
        }

    except Exception as e:
        return {"error": f"Flight search error: {str(e)}"}


def amadeus_flight_search(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: Optional[str] = None,
    adults: int = 1,
    max_results: int = 10,
    currency: str = "INR",
) -> str:
    """
    Search for flight offers using the Amadeus Python SDK.

    Args:
        origin: Origin airport IATA code (e.g., "JFK", "LAX")
        destination: Destination airport IATA code (e.g., "CDG", "LHR")
        departure_date: Departure date in YYYY-MM-DD format
        return_date: Return date in YYYY-MM-DD format (optional, omit for one-way)
        adults: Number of adult passengers (default: 1)
        max_results: Maximum number of results to return (default: 10)
        currency: Currency code (default: "INR")

    Returns:
        Formatted string with flight results
    """
    api_key = os.getenv("AMADEUS_API_KEY", "")
    api_secret = os.getenv("AMADEUS_API_SECRET", "")

    if not api_key or not api_secret:
        logger.warning("Amadeus API credentials not configured for flight search")
        return "Error: Amadeus API credentials not configured."

    try:
        logger.info(
            "amadeus_flight_search: %s → %s, date=%s, return=%s, adults=%d, max=%d, currency=%s",
            origin, destination, departure_date, return_date, adults, max_results, currency,
        )
        amadeus = Client(
            client_id=api_key,
            client_secret=api_secret,
        )

        params = {
            "originLocationCode": origin.upper(),
            "destinationLocationCode": destination.upper(),
            "departureDate": departure_date,
            "adults": adults,
            "currencyCode": currency,
            "max": max_results,
        }
        if return_date:
            params["returnDate"] = return_date

        response = amadeus.shopping.flight_offers_search.get(**params)
        offers = response.data

        if not offers:
            logger.info("No flights found from %s to %s on %s", origin, destination, departure_date)
            return f"No flights found from {origin} to {destination} on {departure_date}."

        logger.info("Found %d flight offers from %s to %s", len(offers), origin, destination)

        trip_type = "Round-trip" if return_date else "One-way"
        formatted = [
            f"Flight Search Results ({trip_type}): {origin.upper()} → {destination.upper()}",
            f"Outbound: {departure_date}" + (f" | Return: {return_date}" if return_date else ""),
            "",
        ]

        for i, offer in enumerate(offers, 1):
            price = offer.get("price", {})
            total = price.get("grandTotal") or price.get("total", "N/A")
            curr = price.get("currency", currency)

            itineraries = offer.get("itineraries", [])
            lines = [f"{i}. ${total} {curr}"]

            for itin_idx, itinerary in enumerate(itineraries):
                direction = "Outbound" if itin_idx == 0 else "Return"
                duration_raw = itinerary.get("duration", "")
                # Parse ISO 8601 duration like PT12H30M
                duration_str = duration_raw.replace("PT", "").replace("H", "h ").replace("M", "m").strip()
                segments = itinerary.get("segments", [])
                stops = len(segments) - 1
                stop_label = "Nonstop" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

                lines.append(f"   {direction} ({duration_str}, {stop_label}):")

                for seg in segments:
                    dep = seg.get("departure", {})
                    arr = seg.get("arrival", {})
                    carrier = seg.get("carrierCode", "")
                    flight_num = seg.get("number", "")
                    aircraft = seg.get("aircraft", {}).get("code", "")

                    dep_time = dep.get("at", "").replace("T", " ")
                    arr_time = arr.get("at", "").replace("T", " ")

                    seg_line = f"     {carrier}{flight_num}: {dep.get('iataCode', '')} ({dep_time}) → {arr.get('iataCode', '')} ({arr_time})"
                    if aircraft:
                        seg_line += f" [{aircraft}]"
                    lines.append(seg_line)

            # Traveler pricing info
            traveler_pricings = offer.get("travelerPricings", [])
            if traveler_pricings:
                cabin = traveler_pricings[0].get("fareDetailsBySegment", [{}])[0].get("cabin", "")
                fare_class = traveler_pricings[0].get("fareDetailsBySegment", [{}])[0].get("class", "")
                if cabin:
                    lines.append(f"   Cabin: {cabin}" + (f" (Class {fare_class})" if fare_class else ""))

            formatted.append("\n".join(lines))

        return "\n\n".join(formatted)

    except ResponseError as error:
        logger.error("Amadeus API error during flight search: %s", error)
        return f"Amadeus API error: {error}"
    except Exception as e:
        logger.exception("Flight search error")
        return f"Flight search error: {str(e)}"


def get_hotel_data(
    city_code: str, ratings: str = "4,5", amenities: str = "AIR_CONDITIONING"
) -> dict:
    """Search for hotels in a city."""
    token = get_amadeus_token()
    if not token:
        return {"error": "Amadeus API not configured or token failed."}

    try:
        params = {"cityCode": city_code}
        if ratings:
            params["ratings"] = ratings
        if amenities:
            params["amenities"] = amenities

        response = requests.get(
            "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=15,
        )

        if response.status_code == 200:
            return response.json()
        return {
            "error": f"Hotel search failed: {response.status_code}",
            "details": response.text,
        }

    except Exception as e:
        return {"error": f"Hotel search error: {str(e)}"}


def amadeus_hotel_search(
    city_code: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 1,
    rooms: int = 1,
    max_results: int = 10,
    currency: str = "INR",
    ratings: Optional[str] = None,
) -> str:
    """
    Search for hotel offers with availability and pricing using the Amadeus Python SDK.

    Args:
        city_code: City IATA code (e.g., "DEL" for Delhi, "BOM" for Mumbai, "NYC" for New York)
        check_in_date: Check-in date in YYYY-MM-DD format
        check_out_date: Check-out date in YYYY-MM-DD format
        adults: Number of adult guests (default: 1)
        rooms: Number of rooms (default: 1)
        max_results: Maximum number of results to return (default: 10)
        currency: Currency code (default: "INR")
        ratings: Hotel star ratings filter, comma-separated (e.g., "4,5" for 4 and 5-star hotels)

    Returns:
        Formatted string with hotel results including availability and pricing
    """
    api_key = os.getenv("AMADEUS_API_KEY", "")
    api_secret = os.getenv("AMADEUS_API_SECRET", "")

    if not api_key or not api_secret:
        logger.warning("Amadeus API credentials not configured for hotel search")
        return "Error: Amadeus API credentials not configured."

    try:
        logger.info(
            "amadeus_hotel_search: city=%s, check_in=%s, check_out=%s, adults=%d, rooms=%d, currency=%s, ratings=%s",
            city_code, check_in_date, check_out_date, adults, rooms, currency, ratings,
        )
        amadeus = Client(
            client_id=api_key,
            client_secret=api_secret,
        )

        # Search for hotel offers
        search_params = {
            "cityCode": city_code.upper(),
            "checkInDate": check_in_date,
            "checkOutDate": check_out_date,
            "adults": adults,
            "roomQuantity": rooms,
            "currency": currency,
            "paymentPolicy": "NONE",  # Get all offers regardless of payment policy
            "bestRateOnly": True,  # Get only the best rate per hotel
        }

        if ratings:
            search_params["ratings"] = ratings

        response = amadeus.shopping.hotel_offers_search.get(**search_params)
        offers = response.data

        if not offers:
            logger.info("No hotel offers found in %s for %s to %s", city_code, check_in_date, check_out_date)
            return f"No hotel offers found in {city_code} for {check_in_date} to {check_out_date}."

        logger.info("Found %d hotel offers in %s", len(offers), city_code)
        logger.info(f"Hotel search response: {response}")

        

        # Limit results
        offers = offers[:max_results]

        # Format results
        formatted = [
            f"Hotel Search Results: {city_code.upper()}",
            f"Check-in: {check_in_date} | Check-out: {check_out_date}",
            f"Guests: {adults} adult(s) | Rooms: {rooms}",
            "",
        ]

        for i, hotel_offer in enumerate(offers, 1):
            hotel = hotel_offer.get("hotel", {})
            hotel_name = hotel.get("name", "Unknown Hotel")
            hotel_id = hotel.get("hotelId", "N/A")

            # Get hotel rating if available
            rating_str = ""
            if "rating" in hotel:
                rating_str = f" ({hotel['rating']}★)"

            # Get the first offer (best rate)
            hotel_offers = hotel_offer.get("offers", [])
            if not hotel_offers:
                continue

            offer = hotel_offers[0]
            price = offer.get("price", {})
            total = price.get("total", "N/A")
            curr = price.get("currency", currency)

            # Room details
            room = offer.get("room", {})
            room_type = room.get("type", "Standard")
            room_desc = room.get("description", {}).get("text", "")

            # Beds
            beds = room.get("typeEstimated", {}).get("beds", 0)
            bed_type = room.get("typeEstimated", {}).get("bedType", "")
            bed_info = f"{beds} {bed_type}" if beds and bed_type else ""

            # Board type (meal plan)
            board_type = offer.get("boardType", "")
            board_info = ""
            if board_type:
                board_map = {
                    "ROOM_ONLY": "Room Only",
                    "BREAKFAST": "Breakfast Included",
                    "HALF_BOARD": "Half Board",
                    "FULL_BOARD": "Full Board",
                    "ALL_INCLUSIVE": "All Inclusive"
                }
                board_info = f" | {board_map.get(board_type, board_type)}"

            # Policies
            cancellation = "Non-refundable"
            policies = offer.get("policies", {})
            if policies.get("cancellation", {}).get("type") == "FULL_CHARGE":
                cancellation = "Non-refundable"
            elif "cancellation" in policies:
                deadline = policies.get("cancellation", {}).get("deadline", "")
                if deadline:
                    cancellation = f"Free cancellation until {deadline}"

            lines = [
                f"{i}. {hotel_name}{rating_str}",
                f"   Price: ₹{total} {curr} (total for {rooms} room(s))",
                f"   Room: {room_type}" + (f" | {bed_info}" if bed_info else "") + board_info,
                f"   Policy: {cancellation}",
            ]

            if room_desc:
                lines.append(f"   Description: {room_desc[:100]}...")

            formatted.append("\n".join(lines))

        return "\n\n".join(formatted)

    except ResponseError as error:
        logger.error("Amadeus API error during hotel search: %s", error)
        return f"Amadeus API error: {error}"
    except Exception as e:
        logger.exception("Hotel search error")
        return f"Hotel search error: {str(e)}"


# =============================================================================
# GOOGLE PLACES TOOL
# =============================================================================


def google_places_search(query: str) -> dict:
    """Search for places using Google Places API."""
    logger.info("google_places_search called with query=%s", query)
    if not GOOGLE_MAPS_KEY:
        logger.warning("Google Maps API key not configured")
        return {"error": "Google Maps API key not configured."}

    try:
        response = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_KEY,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.priceLevel,places.googleMapsUri,places.rating",
            },
            json={"textQuery": query},
            timeout=10,
        )

        if response.status_code == 200:
            result = response.json()
            places_count = len(result.get("places", []))
            logger.info("google_places_search returned %d places for query=%s", places_count, query)
            return result
        logger.warning("Places search failed with status %d", response.status_code)
        return {"error": f"Places search failed: {response.status_code}"}

    except Exception as e:
        logger.exception("Places search error for query=%s", query)
        return {"error": f"Places search error: {str(e)}"}
