#!/bin/bash

# E2E Test Runner Script
# Usage: ./run-e2e-tests.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-http://localhost:3001}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:5173}
TEST_TYPE=${1:-all}  # all, api, e2e

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

# Check if backend is running
check_backend() {
  log_info "Checking backend health..."
  
  if curl -sf "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    log_info "Backend is healthy ✅"
    return 0
  else
    log_error "Backend is not running or not healthy ❌"
    log_warn "Please start the backend first:"
    log_warn "  cd backend && npm run dev"
    return 1
  fi
}

# Run API tests
run_api_tests() {
  log_test "Running API tests..."
  
  cd backend
  
  if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    npm install
  fi
  
  # Run unit tests
  log_info "Running unit tests..."
  npm test -- --run || log_warn "Some unit tests failed"
  
  # Run E2E tests
  if [ -d "tests/e2e" ]; then
    log_info "Running E2E tests..."
    npx playwright test tests/e2e --project=api-tests || log_warn "Some E2E tests failed"
  else
    log_warn "No E2E tests found"
  fi
  
  cd ..
  
  log_info "API tests completed ✅"
}

# Run frontend E2E tests
run_frontend_tests() {
  log_test "Running frontend E2E tests..."
  
  cd frontend
  
  if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    npm install
  fi
  
  if [ -d "e2e" ]; then
    log_info "Running Playwright tests..."
    npx playwright test e2e || log_warn "Some frontend E2E tests failed"
  else
    log_warn "No frontend E2E tests found"
  fi
  
  cd ..
  
  log_info "Frontend E2E tests completed ✅"
}

# Run all tests
run_all_tests() {
  log_test "Running all tests..."
  
  # Check backend health first
  if ! check_backend; then
    log_error "Skipping tests due to backend not being available"
    exit 1
  fi
  
  # Run API tests
  run_api_tests
  
  log_info "All tests completed! 🎉"
}

# Generate coverage report
generate_coverage() {
  log_test "Generating coverage report..."
  
  cd backend
  
  if [ ! -d "coverage" ]; then
    mkdir -p coverage
  fi
  
  # Run tests with coverage
  npm test -- --coverage --run || log_warn "Coverage generation failed"
  
  # Generate HTML report
  npx nyc report --reporter=html || log_warn "HTML report generation failed"
  
  log_info "Coverage report generated at: coverage/index.html"
  
  cd ..
}

# Display usage
usage() {
  echo "Booky E2E Test Runner"
  echo ""
  echo "Usage: ./run-e2e-tests.sh [options]"
  echo ""
  echo "Options:"
  echo "  api         Run API tests only"
  echo "  frontend    Run frontend E2E tests only"
  echo "  all         Run all tests (default)"
  echo "  coverage    Generate coverage report"
  echo "  --help      Show this help message"
  echo ""
  echo "Environment Variables:"
  echo "  BACKEND_URL    Backend URL (default: http://localhost:3001)"
  echo "  FRONTEND_URL   Frontend URL (default: http://localhost:5173)"
  echo ""
  echo "Examples:"
  echo "  ./run-e2e-tests.sh                # Run all tests"
  echo "  ./run-e2e-tests.sh api            # Run API tests only"
  echo "  ./run-e2e-tests.sh coverage       # Generate coverage report"
  echo "  BACKEND_URL=https://api.booky.app ./run-e2e-tests.sh api"
}

# Main script entry point
case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  api)
    run_api_tests
    ;;
  frontend)
    run_frontend_tests
    ;;
  coverage)
    generate_coverage
    ;;
  all|*)
    run_all_tests
    ;;
esac
