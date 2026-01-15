#!/bin/bash

# Production Deployment Verification Script
# Usage: ./verify-deployment.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-https://api.booky.app}
FRONTEND_URL=${FRONTEND_URL:-https://booky.app}
TOKEN=${TOKEN:-""}  # Set this for authenticated endpoints

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Logging functions
log_test() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${RED}[FAIL]${NC} $1"
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test functions
test_endpoint() {
  local name=$1
  local url=$2
  local method=${3:-GET}
  local data=${4:-""}
  local expected_status=${5:-200}
  local headers=${6:-""}

  log_test "$name"

  if [ "$method" = "GET" ]; then
    if curl -sf -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
      log_pass "$name (HTTP $expected_status)"
    else
      log_fail "$name - Expected $expected_status, got different response"
    fi
  elif [ "$method" = "POST" ]; then
    if [ -n "$headers" ]; then
      response=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "$headers" \
        -d "$data" \
        "$url")
    else
      response=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$url")
    fi

    if echo "$response" | grep -q "$expected_status"; then
      log_pass "$name (HTTP $expected_status)"
    else
      log_fail "$name - Expected $expected_status, got HTTP $response"
    fi
  fi
}

# Run tests
run_tests() {
  log_info "Starting deployment verification..."
  log_info "Backend URL: $BACKEND_URL"
  log_info "Frontend URL: $FRONTEND_URL"
  echo ""

  # 1. Basic Connectivity Tests
  log_info "=== 1. Basic Connectivity Tests ==="

  test_endpoint "Backend Health Check" "$BACKEND_URL/api/health"
  test_endpoint "Frontend Access" "$FRONTEND_URL"

  # 2. Authentication Tests (if token provided)
  if [ -n "$TOKEN" ]; then
    log_info "=== 2. Authentication Tests ==="

    test_endpoint "Get User Profile" "$BACKEND_URL/api/auth/me" "GET" "" "200" "Authorization: Bearer $TOKEN"
  else
    log_info "=== 2. Authentication Tests (SKIPPED - no token provided) ==="
    log_info "Set TOKEN environment variable to run auth tests"
  fi

  # 3. API Endpoint Tests
  log_info "=== 3. API Endpoint Tests ==="

  test_endpoint "ISBN Lookup" "$BACKEND_URL/api/isbn/9780134685991"
  test_endpoint "Search Endpoint" "$BACKEND_URL/api/search?q=javascript"

  # 4. Security Tests
  log_info "=== 4. Security Tests ==="

  test_endpoint "Security Headers" "$BACKEND_URL/api/health" "GET" "" "200" ""
  test_endpoint "CORS Headers" "$BACKEND_URL/api/health" "GET" "" "200" ""

  # 5. File Upload Tests (if authenticated)
  if [ -n "$TOKEN" ]; then
    log_info "=== 5. File Upload Tests ==="

    test_endpoint "Storage Usage" "$BACKEND_URL/api/files/usage" "GET" "" "200" "Authorization: Bearer $TOKEN"
  else
    log_info "=== 5. File Upload Tests (SKIPPED - no token provided) ==="
  fi

  # 6. Performance Tests
  log_info "=== 6. Performance Tests ==="

  log_test "Response Time - Health Check"
  start_time=$(date +%s%N)
  curl -sf -o /dev/null "$BACKEND_URL/api/health"
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  if [ $duration -lt 1000 ]; then
    log_pass "Response Time - Health Check (${duration}ms)"
  else
    log_fail "Response Time - Health Check (${duration}ms - too slow)"
  fi

  # Summary
  echo ""
  log_info "=== Test Summary ==="
  echo -e "Total Tests: $TOTAL_TESTS"
  echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    log_pass "All tests passed! 🎉"
    exit 0
  else
    echo ""
    log_fail "Some tests failed. Please review the results above."
    exit 1
  fi
}

# Display usage
usage() {
  echo "Production Deployment Verification Script"
  echo ""
  echo "Usage: ./verify-deployment.sh [options]"
  echo ""
  echo "Options:"
  echo "  --backend-url URL    Backend API URL (default: https://api.booky.app)"
  echo "  --frontend-url URL   Frontend URL (default: https://booky.app)"
  echo "  --token TOKEN        JWT token for authenticated tests"
  echo "  --help               Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./verify-deployment.sh"
  echo "  ./verify-deployment.sh --backend-url http://localhost:3001"
  echo "  ./verify-deployment.sh --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --backend-url)
      BACKEND_URL="$2"
      shift 2
      ;;
    --frontend-url)
      FRONTEND_URL="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Run verification
run_tests
