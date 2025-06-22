#!/bin/bash

# Test API endpoints
# Usage: ./scripts/test-api.sh [API_URL]

set -e

# Default API URL (you can override by passing as argument)
API_URL=${1:-"http://localhost:3000"}

echo "🧪 Testing API endpoints at: $API_URL"
echo "=================================="

# Test health endpoint
echo "📡 Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

echo "Status Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"
echo ""

# Test example endpoint with valid data
echo "📡 Testing /example endpoint with valid data..."
EXAMPLE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  }' \
  "$API_URL/example")

HTTP_CODE=$(echo "$EXAMPLE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$EXAMPLE_RESPONSE" | head -n -1)

echo "Status Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"
echo ""

# Test example endpoint with invalid data (should fail validation)
echo "📡 Testing /example endpoint with invalid data (validation test)..."
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "invalid-email",
    "age": -5
  }' \
  "$API_URL/example")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$INVALID_RESPONSE" | head -n -1)

echo "Status Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"
echo ""

echo "✅ API testing completed!"
echo ""
echo "📊 Check CloudWatch logs for detailed logging and metrics:"
echo "   - Lambda Powertools logs with structured logging"
echo "   - Custom metrics for HealthCheck and ExampleRequest"
echo "   - Request/response logging via middleware"
echo "   - Error tracking and validation errors" 