#!/bin/bash
# Test runner script that verifies dev server auto-start

echo "🧪 Running E2E tests with auto-starting dev server..."
echo ""

# Kill any existing process on port 3001 to prove dev server auto-starts
echo "📋 Checking for processes on port 3001..."
if lsof -ti :3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 is in use, freeing it..."
    kill -9 $(lsof -ti :3001) 2>/dev/null || true
    sleep 2
fi
echo "✅ Port 3001 is now free"
echo ""

# Run e2e tests (Playwright will auto-start dev server)
echo "🚀 Starting Playwright e2e tests..."
echo "   Playwright will automatically start the dev server on port 3001"
echo ""
npx playwright test tests/e2e/essential.spec.ts --project=chromium --reporter=line

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed! Dev server auto-start working correctly."
else
    echo ""
    echo "❌ Tests failed. Check output above for details."
    exit 1
fi