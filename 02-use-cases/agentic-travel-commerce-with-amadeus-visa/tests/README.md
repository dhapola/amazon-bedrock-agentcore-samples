# Hotel Search Test Suite

Comprehensive test suite for the hotel search functionality in the agentic travel commerce application.

## Overview

This test suite covers the `amadeus_hotel_search()` function and `travel_hotel_search()` MCP tool with 70+ test cases across multiple categories.

## Test Categories

### 1. **Valid Input Tests** (`TestHotelSearchValidInputs`)
Tests for valid, expected inputs:
- Various IATA city codes (DEL, BOM, NYC, LON, HYD)
- Different guest and room combinations (1-6 adults, 1-3 rooms)
- Hotel rating filters (3-star, 4-star, 5-star combinations)
- Date ranges (same month, across months, long stays)
- Multiple currency codes (INR, USD, EUR, GBP, JPY)

### 2. **Invalid Input Tests** (`TestHotelSearchInvalidInputs`)
Tests for error handling with invalid inputs:
- Invalid city codes (too short, too long, numeric, special characters)
- Invalid date formats and ranges
- Check-out before check-in dates
- Same check-in and check-out dates
- Past dates
- Zero or negative adults/rooms count
- Invalid rating formats
- Non-existent currency codes

### 3. **Edge Cases** (`TestHotelSearchEdgeCases`)
Tests for boundary conditions:
- One-night stay (minimum)
- Max results boundaries (0, negative, very large)
- Single vs. multiple rating filters
- Lowercase and mixed-case city codes

### 4. **API Interaction Tests** (`TestHotelSearchAPIInteraction`)
Tests for Amadeus API scenarios:
- Missing API credentials
- Successful API responses
- No results found
- API error responses (400, 500)
- Request timeouts
- Network connectivity issues

### 5. **Response Formatting Tests** (`TestHotelSearchResponseFormatting`)
Tests to verify response includes:
- Hotel name
- Price information
- Check-in/check-out dates
- Room type and details
- Cancellation policy
- Board type (meal plan)
- Star rating

### 6. **Integration Tests** (`TestHotelSearchIntegration`)
Real-world scenario tests:
- BLR to HYD trip scenario (from user requirements)
- Hitech City area search
- Breakfast included filter
- Multi-night stay pricing

### 7. **Performance Tests** (`TestHotelSearchPerformance`)
Performance and load considerations:
- Response time limits (15 seconds)
- Concurrent search handling
- Large result set handling

### 8. **Security Tests** (`TestHotelSearchSecurity`)
Security validation:
- API key exposure prevention
- SQL injection protection
- XSS prevention in hotel names

## Setup

### Install Test Dependencies

```bash
cd tests
pip install -r requirements-test.txt
```

### Set Environment Variables

For tests that interact with the actual API:

```bash
export AMADEUS_API_KEY="your_api_key"
export AMADEUS_API_SECRET="your_api_secret"
export AWS_REGION="us-east-1"
```

## Running Tests

### Run All Tests

```bash
# From the project root
pytest tests/test_hotel_search.py -v

# From the tests directory
cd tests
pytest test_hotel_search.py -v
```

### Run Specific Test Classes

```bash
# Valid input tests only
pytest tests/test_hotel_search.py::TestHotelSearchValidInputs -v

# API interaction tests only
pytest tests/test_hotel_search.py::TestHotelSearchAPIInteraction -v

# Integration tests only
pytest tests/test_hotel_search.py::TestHotelSearchIntegration -v
```

### Run Specific Test Cases

```bash
# Single test case
pytest tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_city_codes -v

# Test with specific parameters
pytest tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_guest_room_combinations -v
```

### Run with Coverage

```bash
pytest tests/test_hotel_search.py --cov=agentic_commerce.mcp_travel_tools --cov-report=html
```

This generates an HTML coverage report in `htmlcov/index.html`.

### Run with Markers

```bash
# Run only API tests
pytest tests/test_hotel_search.py -m api -v

# Run everything except slow tests
pytest tests/test_hotel_search.py -m "not slow" -v
```

## Test Data

### User Scenario (from TODO.md)

The test suite includes a specific integration test based on the user's requirement:

**Trip Details:**
- Route: BLR (Bangalore) → HYD (Hyderabad)
- Travel dates: April 10-12, 2026
- Hotel preference: 5-star hotels in Hitech City area
- Requirements: Breakfast included

**Test Case:**
```python
test_bangalore_to_hyderabad_scenario()
```

This validates:
- City code: HYD
- Check-in: 2026-04-10
- Check-out: 2026-04-12 (2-night stay)
- Ratings: "5" (5-star only)
- Adults: 1, Rooms: 1

## Expected Test Results

### Passing Tests
- All valid input tests should pass
- Edge case tests should validate boundaries correctly
- Mocked API tests should verify error handling

### Tests Requiring Real API
Some tests require actual Amadeus API credentials and will be skipped if credentials are not available:
- `test_api_successful_response`
- `test_api_no_results`
- Real integration tests

## Common Issues

### Import Errors
If you see `ModuleNotFoundError: No module named 'tools'`:
```bash
# Ensure you're in the correct directory
cd /path/to/agentic-travel-commerce-with-amadeus-visa
export PYTHONPATH="${PYTHONPATH}:$(pwd)/agentic_commerce/mcp_travel_tools"
```

### API Credential Errors
If tests fail with "API credentials not configured":
- Set `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` environment variables
- Or run only unit tests without API interaction

### Mock Import Errors
If you see errors related to `unittest.mock`:
```bash
pip install pytest-mock
```

## Continuous Integration

To integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run hotel search tests
  run: |
    pip install -r tests/requirements-test.txt
    pytest tests/test_hotel_search.py --junitxml=test-results.xml
```

## Contributing

When adding new test cases:
1. Follow the existing test class structure
2. Use descriptive test names that explain what is being tested
3. Add docstrings to explain the test purpose
4. Use `@pytest.mark.parametrize` for testing multiple inputs
5. Mock external API calls for unit tests
6. Update this README with new test categories

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage of `amadeus_hotel_search()` function
- **Integration Tests**: Cover all user-facing scenarios
- **API Tests**: Handle all Amadeus API response types
- **Edge Cases**: Test all boundary conditions and error paths

## Related Files

- Implementation: [`agentic_commerce/mcp_travel_tools/tools.py`](../agentic_commerce/mcp_travel_tools/tools.py)
- MCP Server: [`agentic_commerce/mcp_travel_tools/server.py`](../agentic_commerce/mcp_travel_tools/server.py)
- User Requirements: [`TODO.md`](../TODO.md)
