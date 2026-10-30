# Hotel Search Tests - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
cd tests
pip install -r requirements-test.txt
```

### Step 2: Set Environment Variables (Optional for mocked tests)
```bash
export AMADEUS_API_KEY="your_test_api_key"
export AMADEUS_API_SECRET="your_test_api_secret"
export AWS_REGION="us-east-1"
```

### Step 3: Run Tests
```bash
# Run all tests
pytest test_hotel_search.py -v

# Run with coverage report
pytest test_hotel_search.py --cov=../agentic_commerce/mcp_travel_tools --cov-report=html
```

---

## 📊 Test Results Summary

After running, you should see:
```
✓ 62 test cases covering:
  - 12 valid input scenarios
  - 15 invalid input validations
  - 11 edge cases
  - 7 API interaction scenarios
  - 7 response format checks
  - 4 integration tests
  - 3 performance tests
  - 3 security tests
```

---

## 🎯 Common Use Cases

### Test Your Changes
```bash
# After modifying tools.py
pytest test_hotel_search.py::TestHotelSearchValidInputs -v
```

### Test API Integration
```bash
# Test with real API credentials
pytest test_hotel_search.py::TestHotelSearchAPIInteraction -v
```

### Test User Scenario
```bash
# Test BLR to HYD trip (from TODO.md)
pytest test_hotel_search.py::TestHotelSearchIntegration::test_bangalore_to_hyderabad_scenario -v
```

### Test Security
```bash
# Run security tests
pytest test_hotel_search.py::TestHotelSearchSecurity -v
```

---

## 📝 Example Test Output

```
tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_city_codes[DEL-2026-06-15-2026-06-20-DEL] PASSED
tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_city_codes[BOM-2026-07-01-2026-07-05-BOM] PASSED
tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_city_codes[HYD-2026-04-10-2026-04-12-HYD] PASSED
tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_guest_room_combinations[1-1] PASSED
tests/test_hotel_search.py::TestHotelSearchValidInputs::test_valid_guest_room_combinations[2-1] PASSED
...
========================================== 62 passed in 2.34s ==========================================
```

---

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'tools'"
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)/../agentic_commerce/mcp_travel_tools"
pytest test_hotel_search.py -v
```

### "API credentials not configured"
This is expected for mocked tests. To test real API:
```bash
export AMADEUS_API_KEY="your_key"
export AMADEUS_API_SECRET="your_secret"
```

### Tests are slow
```bash
# Skip slow tests
pytest test_hotel_search.py -m "not slow" -v
```

---

## 📚 More Information

- Full test documentation: [README.md](README.md)
- Detailed test cases: [HOTEL_SEARCH_TEST_CASES.md](HOTEL_SEARCH_TEST_CASES.md)
- Implementation code: [../agentic_commerce/mcp_travel_tools/tools.py](../agentic_commerce/mcp_travel_tools/tools.py)

---

## ✅ Quick Validation Checklist

Before committing code changes:
- [ ] All unit tests pass
- [ ] No new security vulnerabilities
- [ ] Code coverage > 80%
- [ ] Integration tests pass for user scenarios
- [ ] API error handling works correctly

Run this command to check everything:
```bash
pytest test_hotel_search.py -v --cov=../agentic_commerce/mcp_travel_tools --cov-report=term-missing
```
