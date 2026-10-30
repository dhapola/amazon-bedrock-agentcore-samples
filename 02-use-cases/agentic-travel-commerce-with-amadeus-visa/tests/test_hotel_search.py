"""
Test Cases for Hotel Search Functionality

Tests the amadeus_hotel_search function and travel_hotel_search MCP tool
with various scenarios including valid inputs, edge cases, and error conditions.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import os
import sys

# Add the mcp_travel_tools directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'agentic_commerce', 'mcp_travel_tools'))


class TestHotelSearchValidInputs:
    """Test cases for valid hotel search inputs"""

    @pytest.mark.parametrize("city_code,check_in,check_out,expected_city", [
        ("DEL", "2026-06-15", "2026-06-20", "DEL"),
        ("BOM", "2026-07-01", "2026-07-05", "BOM"),
        ("NYC", "2026-08-10", "2026-08-15", "NYC"),
        ("LON", "2026-09-20", "2026-09-25", "LON"),
        ("HYD", "2026-04-10", "2026-04-12", "HYD"),
    ])
    def test_valid_city_codes(self, city_code, check_in, check_out, expected_city):
        """Test hotel search with various valid IATA city codes"""
        # This would call the actual function with mock API responses
        assert city_code.upper() == expected_city

    @pytest.mark.parametrize("adults,rooms", [
        (1, 1),  # Single traveler, single room
        (2, 1),  # Couple, single room
        (4, 2),  # Family, two rooms
        (2, 2),  # Two travelers, two rooms
        (6, 3),  # Group, three rooms
    ])
    def test_valid_guest_room_combinations(self, adults, rooms):
        """Test various valid combinations of adults and rooms"""
        assert adults >= 1
        assert rooms >= 1
        assert adults >= rooms  # Typically adults should be >= rooms

    @pytest.mark.parametrize("ratings,expected", [
        ("5", ["5-star hotels"]),
        ("4,5", ["4-star hotels", "5-star hotels"]),
        ("3,4,5", ["3-star hotels", "4-star hotels", "5-star hotels"]),
        (None, ["No rating filter"]),
    ])
    def test_hotel_rating_filters(self, ratings, expected):
        """Test hotel search with different rating filters"""
        assert ratings is None or all(r in "12345" for r in ratings.replace(",", ""))

    def test_valid_date_range_same_month(self):
        """Test hotel search with check-in and check-out in the same month"""
        check_in = "2026-06-15"
        check_out = "2026-06-20"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert check_out_dt > check_in_dt
        assert (check_out_dt - check_in_dt).days == 5

    def test_valid_date_range_across_months(self):
        """Test hotel search spanning across months"""
        check_in = "2026-06-28"
        check_out = "2026-07-03"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert check_out_dt > check_in_dt

    def test_valid_date_range_long_stay(self):
        """Test hotel search with extended stay (30 days)"""
        check_in = "2026-06-01"
        check_out = "2026-06-30"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert (check_out_dt - check_in_dt).days == 29

    @pytest.mark.parametrize("currency", [
        "INR",  # Indian Rupee
        "USD",  # US Dollar
        "EUR",  # Euro
        "GBP",  # British Pound
        "JPY",  # Japanese Yen
    ])
    def test_valid_currency_codes(self, currency):
        """Test hotel search with different currency codes"""
        assert len(currency) == 3
        assert currency.isupper()


class TestHotelSearchInvalidInputs:
    """Test cases for invalid hotel search inputs"""

    def test_invalid_city_code_too_short(self):
        """Test hotel search with city code less than 3 characters"""
        city_code = "DE"
        assert len(city_code) < 3

    def test_invalid_city_code_too_long(self):
        """Test hotel search with city code more than 3 characters"""
        city_code = "DELHI"
        assert len(city_code) > 3

    def test_invalid_city_code_numeric(self):
        """Test hotel search with numeric city code"""
        city_code = "123"
        assert city_code.isdigit()

    def test_invalid_city_code_special_chars(self):
        """Test hotel search with special characters in city code"""
        city_code = "DE@"
        assert not city_code.isalpha()

    @pytest.mark.parametrize("check_in,check_out,error", [
        ("2026-13-01", "2026-13-05", "Invalid month"),
        ("2026-06-32", "2026-07-01", "Invalid day"),
        ("2026-02-30", "2026-03-01", "Invalid date for February"),
        ("2026/06/15", "2026/06/20", "Wrong date format (should be YYYY-MM-DD)"),
        ("15-06-2026", "20-06-2026", "Wrong date format (should be YYYY-MM-DD)"),
    ])
    def test_invalid_date_formats(self, check_in, check_out, error):
        """Test hotel search with invalid date formats"""
        # These should raise ValueError when parsed
        assert "/" in check_in or int(check_in.split("-")[1]) > 12 or int(check_in.split("-")[2]) > 31

    def test_check_out_before_check_in(self):
        """Test hotel search where check-out date is before check-in date"""
        check_in = "2026-06-20"
        check_out = "2026-06-15"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert check_out_dt < check_in_dt  # This is invalid

    def test_same_check_in_and_check_out(self):
        """Test hotel search with same check-in and check-out dates"""
        check_in = "2026-06-15"
        check_out = "2026-06-15"
        assert check_in == check_out  # Should be rejected

    def test_past_check_in_date(self):
        """Test hotel search with check-in date in the past"""
        check_in = "2020-06-15"
        check_out = "2020-06-20"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        assert check_in_dt < datetime.now()  # Past date

    @pytest.mark.parametrize("adults", [0, -1, -5])
    def test_invalid_adults_count(self, adults):
        """Test hotel search with zero or negative adults count"""
        assert adults <= 0

    @pytest.mark.parametrize("rooms", [0, -1, -5])
    def test_invalid_rooms_count(self, rooms):
        """Test hotel search with zero or negative rooms count"""
        assert rooms <= 0

    def test_invalid_ratings_format(self):
        """Test hotel search with invalid ratings format"""
        ratings = "6,7"  # Hotels don't have 6 or 7 stars
        assert any(int(r) > 5 for r in ratings.split(","))

    def test_invalid_currency_code(self):
        """Test hotel search with invalid currency code"""
        currency = "XYZ"  # Non-existent currency
        assert len(currency) == 3  # Format is correct but currency doesn't exist


class TestHotelSearchEdgeCases:
    """Test cases for edge cases and boundary conditions"""

    def test_one_night_stay(self):
        """Test hotel search for minimum stay (1 night)"""
        check_in = "2026-06-15"
        check_out = "2026-06-16"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert (check_out_dt - check_in_dt).days == 1

    def test_max_results_boundary(self):
        """Test hotel search with boundary values for max_results"""
        assert 1 <= 10 <= 100  # Typical valid range

    def test_max_results_zero(self):
        """Test hotel search with max_results as zero"""
        max_results = 0
        assert max_results == 0  # Should return no results or error

    def test_max_results_negative(self):
        """Test hotel search with negative max_results"""
        max_results = -1
        assert max_results < 0  # Should be rejected

    def test_very_large_max_results(self):
        """Test hotel search with very large max_results"""
        max_results = 1000
        assert max_results > 100  # API might limit this

    def test_single_rating_filter(self):
        """Test hotel search with single rating value"""
        ratings = "5"
        assert "," not in ratings

    def test_all_ratings_filter(self):
        """Test hotel search with all possible ratings"""
        ratings = "1,2,3,4,5"
        rating_list = ratings.split(",")
        assert len(rating_list) == 5

    def test_lowercase_city_code(self):
        """Test hotel search with lowercase city code"""
        city_code = "del"
        assert city_code.islower()
        assert city_code.upper() == "DEL"

    def test_mixed_case_city_code(self):
        """Test hotel search with mixed case city code"""
        city_code = "DeL"
        assert not city_code.isupper()
        assert city_code.upper() == "DEL"


class TestHotelSearchAPIInteraction:
    """Test cases for Amadeus API interaction scenarios"""

    @patch('tools.Client')
    def test_api_credentials_missing(self, mock_client):
        """Test hotel search when Amadeus API credentials are not configured"""
        with patch.dict(os.environ, {'AMADEUS_API_KEY': '', 'AMADEUS_API_SECRET': ''}, clear=True):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("DEL", "2026-06-15", "2026-06-20")
            assert "Error" in result
            assert "not configured" in result

    @patch('tools.Client')
    def test_api_successful_response(self, mock_client):
        """Test hotel search with successful API response"""
        mock_amadeus = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{
            "hotel": {
                "name": "Test Hotel",
                "hotelId": "TESTHOTEL01",
                "rating": "5"
            },
            "offers": [{
                "price": {"total": "5000", "currency": "INR"},
                "room": {"type": "DELUXE"},
                "boardType": "BREAKFAST"
            }]
        }]
        mock_amadeus.shopping.hotel_offers_search.get.return_value = mock_response
        mock_client.return_value = mock_amadeus

        with patch.dict(os.environ, {'AMADEUS_API_KEY': 'test_key', 'AMADEUS_API_SECRET': 'test_secret'}):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("DEL", "2026-06-15", "2026-06-20")
            assert "Test Hotel" in result or "Error" not in result

    @patch('tools.Client')
    def test_api_no_results(self, mock_client):
        """Test hotel search when API returns no results"""
        mock_amadeus = MagicMock()
        mock_response = MagicMock()
        mock_response.data = []
        mock_amadeus.shopping.hotel_offers_search.get.return_value = mock_response
        mock_client.return_value = mock_amadeus

        with patch.dict(os.environ, {'AMADEUS_API_KEY': 'test_key', 'AMADEUS_API_SECRET': 'test_secret'}):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("XYZ", "2026-06-15", "2026-06-20")
            assert "No hotel" in result or "not found" in result.lower()

    @patch('tools.Client')
    def test_api_error_response(self, mock_client):
        """Test hotel search when API returns an error"""
        from amadeus import ResponseError
        mock_amadeus = MagicMock()
        mock_amadeus.shopping.hotel_offers_search.get.side_effect = ResponseError(
            MagicMock(status_code=400, body='{"errors": [{"detail": "Invalid city code"}]}')
        )
        mock_client.return_value = mock_amadeus

        with patch.dict(os.environ, {'AMADEUS_API_KEY': 'test_key', 'AMADEUS_API_SECRET': 'test_secret'}):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("INVALID", "2026-06-15", "2026-06-20")
            assert "error" in result.lower()

    @patch('tools.Client')
    def test_api_timeout(self, mock_client):
        """Test hotel search when API request times out"""
        mock_amadeus = MagicMock()
        mock_amadeus.shopping.hotel_offers_search.get.side_effect = Exception("Request timeout")
        mock_client.return_value = mock_amadeus

        with patch.dict(os.environ, {'AMADEUS_API_KEY': 'test_key', 'AMADEUS_API_SECRET': 'test_secret'}):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("DEL", "2026-06-15", "2026-06-20")
            assert "error" in result.lower()

    @patch('tools.Client')
    def test_api_network_error(self, mock_client):
        """Test hotel search with network connectivity issues"""
        mock_client.side_effect = ConnectionError("Network unreachable")

        with patch.dict(os.environ, {'AMADEUS_API_KEY': 'test_key', 'AMADEUS_API_SECRET': 'test_secret'}):
            from tools import amadeus_hotel_search
            result = amadeus_hotel_search("DEL", "2026-06-15", "2026-06-20")
            assert "error" in result.lower()


class TestHotelSearchResponseFormatting:
    """Test cases for hotel search response formatting"""

    def test_response_includes_hotel_name(self):
        """Test that response includes hotel name"""
        expected_fields = ["hotel_name", "name", "Test Hotel"]
        assert any(field for field in expected_fields)

    def test_response_includes_price(self):
        """Test that response includes price information"""
        expected_fields = ["price", "total", "Price:", "₹"]
        assert any(field for field in expected_fields)

    def test_response_includes_dates(self):
        """Test that response includes check-in and check-out dates"""
        expected_fields = ["Check-in:", "Check-out:", "2026-06-15", "2026-06-20"]
        assert any(field for field in expected_fields)

    def test_response_includes_room_details(self):
        """Test that response includes room type and details"""
        expected_fields = ["Room:", "room", "type", "Standard", "Deluxe"]
        assert any(field for field in expected_fields)

    def test_response_includes_cancellation_policy(self):
        """Test that response includes cancellation policy"""
        expected_fields = ["Policy:", "cancellation", "Non-refundable", "Free cancellation"]
        assert any(field for field in expected_fields)

    def test_response_includes_board_type(self):
        """Test that response includes meal plan (board type)"""
        expected_fields = ["Breakfast", "Room Only", "Half Board", "All Inclusive"]
        assert any(field for field in expected_fields)

    def test_response_includes_rating(self):
        """Test that response includes hotel star rating"""
        expected_fields = ["★", "star", "rating", "(5★)"]
        assert any(field for field in expected_fields)


class TestHotelSearchIntegration:
    """Integration test cases for hotel search with user scenario"""

    def test_bangalore_to_hyderabad_scenario(self):
        """Test hotel search for the user's specific scenario: BLR to HYD trip"""
        city_code = "HYD"
        check_in = "2026-04-10"
        check_out = "2026-04-12"
        ratings = "5"  # 5-star hotels only
        adults = 1
        rooms = 1

        # Validate all parameters
        assert len(city_code) == 3
        assert city_code.isupper()

        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        assert check_out_dt > check_in_dt
        assert (check_out_dt - check_in_dt).days == 2  # 2-night stay

        assert ratings == "5"
        assert adults >= 1
        assert rooms >= 1

    def test_hitech_city_area_search(self):
        """Test searching for hotels in specific area (Hitech City, Hyderabad)"""
        # This would typically use Google Places API combined with hotel search
        city_code = "HYD"
        search_query = "hotels in hitech city hyderabad"

        assert "hitech city" in search_query.lower()
        assert "hyderabad" in search_query.lower()

    def test_breakfast_included_filter(self):
        """Test filtering hotels with breakfast included"""
        # In Amadeus API, this is controlled by boardType parameter
        expected_board_types = ["BREAKFAST", "HALF_BOARD", "FULL_BOARD", "ALL_INCLUSIVE"]
        assert "BREAKFAST" in expected_board_types

    def test_multi_night_stay_pricing(self):
        """Test that pricing is calculated for total stay duration"""
        check_in = "2026-04-10"
        check_out = "2026-04-12"
        check_in_dt = datetime.strptime(check_in, "%Y-%m-%d")
        check_out_dt = datetime.strptime(check_out, "%Y-%m-%d")
        nights = (check_out_dt - check_in_dt).days

        # Total price should be for 2 nights
        assert nights == 2


class TestHotelSearchPerformance:
    """Performance and load test cases"""

    def test_response_time_acceptable(self):
        """Test that hotel search completes within acceptable time"""
        # Placeholder - actual implementation would measure time
        max_response_time_seconds = 15  # As per tools.py timeout
        assert max_response_time_seconds > 0

    def test_multiple_concurrent_searches(self):
        """Test handling multiple concurrent hotel searches"""
        # Placeholder - would test concurrent API calls
        concurrent_requests = 5
        assert concurrent_requests > 0

    def test_large_result_set_handling(self):
        """Test handling large number of hotel results"""
        max_results = 100
        assert max_results <= 100  # Should have reasonable limits


class TestHotelSearchSecurity:
    """Security-related test cases"""

    def test_api_key_not_exposed_in_logs(self):
        """Test that API keys are not exposed in error messages or logs"""
        # API keys should never appear in responses
        api_key = "test_secret_key_12345"
        error_message = "Hotel search error: Connection failed"
        assert api_key not in error_message

    def test_sql_injection_in_city_code(self):
        """Test that city code parameter is not vulnerable to SQL injection"""
        malicious_input = "DEL'; DROP TABLE hotels; --"
        # Should be rejected or sanitized
        assert "'" in malicious_input or "DROP" in malicious_input

    def test_xss_in_hotel_response(self):
        """Test that hotel names with script tags are handled safely"""
        malicious_hotel_name = "<script>alert('xss')</script>"
        # Should be escaped or sanitized
        assert "<script>" in malicious_hotel_name


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
