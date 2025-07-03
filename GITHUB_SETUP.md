# GitHub Setup & Replit Import Guide

## 🚀 Quick Start (For Users)

### Option 1: Use Our Template (Recommended)
1. Go to: [github.com/your-org/interview-platform-template](https://github.com/your-org/interview-platform-template)
2. Click "Use this template" → "Create a new repository"
3. Name your repo (e.g., `my-interview-platform`)
4. Click "Create repository"
5. Go to [Replit](https://replit.com) → "Create Repl" → "Import from GitHub"
6. Paste your new repo URL
7. Follow the [Replit Setup Guide](REPLIT_SETUP.md)

### Option 2: Fork & Clone
```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/interview-platform.git
cd interview-platform
npm install
```

## 🔧 For Repository Owners

### Initial GitHub Setup

1. **Create New Repository**
```bash
# Initialize git in your project
cd interview-platform
git init

# Create initial commit
git add .
git commit -m "Initial commit: AI Interview Platform"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/interview-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

2. **Configure Repository Settings**
- Go to Settings → Secrets and variables → Actions
- Add these repository secrets:
  ```
  REPLIT_DEPLOYMENT_URL
  CLAUDE_API_KEY_TEST
  ```

3. **Enable GitHub Pages (Optional)**
- Settings → Pages → Source: Deploy from branch
- Branch: main, Folder: /docs

### Repository Structure
```
interview-platform/
├── .github/
│   └── workflows/
│       └── test.yml          # CI/CD pipeline
├── src/                      # Source code
├── data/                     # Data files
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
├── README.md                # Main documentation
├── REPLIT_SETUP.md         # Replit guide
├── GITHUB_SETUP.md         # This file
└── LICENSE                  # MIT License
```

## 🔒 Security Best Practices

### Never Commit:
- `.env` files with real API keys
- `data/interviews.json` with real data
- Any `uploads/` or `recordings/`
- Service account JSON files

### Always Use:
- Environment variables for secrets
- `.gitignore` to exclude sensitive files
- Replit Secrets for API keys
- GitHub Secrets for CI/CD

## 📝 Contributing Guidelines

### For Contributors:
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style:
- Use 2 spaces for indentation
- Follow ES6+ JavaScript standards
- Add JSDoc comments for functions
- Test before submitting PR

## 🤖 GitHub Actions

The repository includes automated workflows:

### Test Workflow (.github/workflows/test.yml)
- Runs on every push and PR
- Validates code syntax
- Checks for security vulnerabilities
- Ensures all dependencies are secure

### Deploy Workflow (Optional)
Add `.github/workflows/deploy.yml` for auto-deployment to Replit

## 📦 Release Process

### Creating a Release:
1. Update version in `package.json`
2. Create changelog entry
3. Commit: `git commit -m "Release v1.0.0"`
4. Tag: `git tag -a v1.0.0 -m "Release version 1.0.0"`
5. Push: `git push origin main --tags`
6. Create GitHub Release with notes

### Semantic Versioning:
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

## 🔗 Integration with Replit

### Automatic Import:
1. Ensure repository is public
2. Add "Import on Replit" button to README:
```markdown
[![Run on Replit](https://replit.com/badge/github/YOUR_USERNAME/interview-platform)](https://replit.com/new/github/YOUR_USERNAME/interview-platform)
```

### Replit Configuration:
- `.replit` file configures run command
- `replit.nix` specifies system dependencies
- Secrets must be added manually in Replit

## 📚 Documentation

### README.md Should Include:
- Project overview
- Features list
- Quick start guide
- Link to full documentation
- Contributing guidelines
- License information

### Additional Docs:
- `docs/API.md` - API documentation
- `docs/DEPLOYMENT.md` - Deployment options
- `docs/TROUBLESHOOTING.md` - Common issues

## 🐛 Issue Templates

Create `.github/ISSUE_TEMPLATE/`:
- `bug_report.md`
- `feature_request.md`
- `question.md`

## 📄 License

Include MIT License in `LICENSE` file:
```
MIT License

Copyright (c) 2024 [Your Name/Organization]

Permission is hereby granted, free of charge...
```

## 🚨 Important Notes

1. **API Keys**: Never commit real API keys
2. **Data Privacy**: Don't store candidate PII in repo
3. **Security**: Enable 2FA on GitHub account
4. **Branches**: Protect main branch
5. **Reviews**: Require PR reviews for main

## 🎯 Next Steps

After setting up GitHub:
1. Add collaborators
2. Set up branch protection
3. Configure webhooks
4. Enable security alerts
5. Add status badges to README

---

For questions, open an issue or contact: support@your-org.com