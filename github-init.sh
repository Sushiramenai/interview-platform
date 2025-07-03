#!/bin/bash

# GitHub Repository Initialization Script for Interview Platform
# This script helps you set up the repository on GitHub

echo "🚀 AI Interview Platform - GitHub Setup"
echo "======================================"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Check if already in a git repository
if [ -d .git ]; then
    echo "⚠️  This directory is already a git repository."
    read -p "Do you want to reinitialize? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    rm -rf .git
fi

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME
if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ GitHub username is required"
    exit 1
fi

# Get repository name
read -p "Enter repository name (default: interview-platform): " REPO_NAME
REPO_NAME=${REPO_NAME:-interview-platform}

# Initialize git
echo "📁 Initializing git repository..."
git init

# Update README with correct username
echo "📝 Updating README with your GitHub username..."
sed -i.bak "s/YOUR_USERNAME/$GITHUB_USERNAME/g" README.md
rm README.md.bak

# Create initial commit
echo "💾 Creating initial commit..."
git add .
git commit -m "Initial commit: AI Interview Platform with Claude, Google Meet, and Recall.ai integration"

# Set main branch
git branch -M main

# Add remote
echo "🔗 Adding GitHub remote..."
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo ""
echo "✅ Local repository initialized!"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub:"
echo "   https://github.com/new"
echo "   - Repository name: $REPO_NAME"
echo "   - Make it public (for Replit import)"
echo "   - DON'T initialize with README, .gitignore, or license"
echo ""
echo "2. Push your code:"
echo "   git push -u origin main"
echo ""
echo "3. Set up repository secrets in GitHub:"
echo "   Go to: Settings → Secrets and variables → Actions"
echo "   Add any CI/CD secrets you need"
echo ""
echo "4. Your Replit import URL will be:"
echo "   https://replit.com/new/github/$GITHUB_USERNAME/$REPO_NAME"
echo ""
echo "5. Share the 'Run on Replit' button:"
echo "   [![Run on Replit](https://replit.com/badge/github/$GITHUB_USERNAME/$REPO_NAME)](https://replit.com/new/github/$GITHUB_USERNAME/$REPO_NAME)"
echo ""
echo "📚 For detailed setup instructions, see:"
echo "   - GITHUB_SETUP.md"
echo "   - REPLIT_SETUP.md"
echo ""

# Make the script executable
chmod +x github-init.sh

echo "🎉 Setup complete! Happy coding!"