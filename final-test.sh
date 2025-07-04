#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        🚀 Senbird Platform Final Test                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
    else
        echo "❌ $2"
    fi
}

# Test 1: Check Node.js dependencies
echo "1️⃣ Checking Dependencies..."
if [ -d "node_modules" ]; then
    print_status 0 "Dependencies installed"
else
    echo "   Installing dependencies..."
    npm install --silent
    print_status $? "Dependencies installation"
fi

# Test 2: Test configuration
echo ""
echo "2️⃣ Testing Configuration..."
if [ -f "config.json" ]; then
    print_status 0 "Config file exists"
else
    echo '{"openai_api_key":"","elevenlabs_api_key":""}' > config.json
    print_status 0 "Created empty config file"
fi

# Test 3: Start server
echo ""
echo "3️⃣ Starting Server..."
node server.js > server.log 2>&1 &
SERVER_PID=$!
sleep 3

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    print_status 0 "Server started successfully (PID: $SERVER_PID)"
    
    # Test 4: Check endpoints
    echo ""
    echo "4️⃣ Testing Endpoints..."
    
    # Test HR Dashboard
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/hr-dashboard.html | grep -q "200"
    print_status $? "HR Dashboard accessible"
    
    # Test Interview page
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/interview.html | grep -q "200"
    print_status $? "Interview page accessible"
    
    # Test API endpoint
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/config | grep -q "200"
    print_status $? "Config API endpoint"
    
else
    print_status 1 "Server failed to start"
    echo "   Server logs:"
    head -20 server.log
fi

# Cleanup
kill $SERVER_PID 2>/dev/null
rm -f server.log

echo ""
echo "📊 Test Complete!"
echo ""
echo "🔗 Access Points:"
echo "   - HR Dashboard: http://localhost:3000/hr-dashboard.html"
echo "   - Interview Room: http://localhost:3000/interview.html"
echo "   - Results: http://localhost:3000/results.html"
echo ""
echo "📝 Next Steps:"
echo "   1. Add your API keys via the settings in HR Dashboard"
echo "   2. Create interview templates for different positions"
echo "   3. Test the interview flow with video/audio recording"