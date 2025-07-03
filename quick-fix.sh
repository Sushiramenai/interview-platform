#!/bin/bash

echo "🔧 Interview Platform Quick Fix Script"
echo "====================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p data src/roles src/reports uploads transcripts temp

# Check if sample role exists
if [ ! -f "src/roles/customer_support_specialist.json" ]; then
    echo "📋 Creating sample role..."
    cat > src/roles/customer_support_specialist.json << 'EOF'
{
  "role": "Customer Support Specialist",
  "job_description": "We are looking for a friendly and patient Customer Support Specialist.",
  "requirements": ["2+ years experience", "Excellent communication"],
  "traits": ["empathetic", "patient", "solution-focused"],
  "questions": ["Tell me about yourself", "Why customer support?"],
  "behavioral_questions": ["Describe handling a difficult customer"]
}
EOF
fi

# Create empty results file if needed
if [ ! -f "data/results.json" ]; then
    echo "[]" > data/results.json
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Start the server: npm start"
echo "2. Open: http://localhost:3000/login"
echo "3. Login: Admin / admin123"
echo ""
echo "⚡ Quick API Setup:"
echo "Run: node setup-api-keys.js"
echo ""
echo "📚 Having issues? Check:"
echo "- SOLUTION_OPTIONS.md for alternatives"
echo "- FIXES_APPLIED.md for details"