# 🚀 Quick Start: GitHub → Replit in 5 Minutes

## Step 1: Run Setup Script
```bash
cd interview-platform
./github-init.sh
```

## Step 2: Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Name: `interview-platform` (or your choice)
3. Public repository (required for Replit)
4. **DON'T** add README, .gitignore, or license
5. Click "Create repository"

## Step 3: Push to GitHub
```bash
git push -u origin main
```

## Step 4: Import to Replit
1. Go to your new repo: `github.com/YOUR_USERNAME/interview-platform`
2. Copy the URL
3. Go to [replit.com](https://replit.com)
4. Click "Create Repl" → "Import from GitHub"
5. Paste your repo URL
6. Click "Import from GitHub"

## Step 5: Configure Replit Secrets
In your Repl, click the 🔐 Secrets tab and add:

### Required (Get these from respective services):
```
CLAUDE_API_KEY=sk-ant-...
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=SecurePassword123!
JWT_SECRET=your-32-character-secret-key-here
```

### Optional (For full features):
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
ELEVENLABS_API_KEY=...
RECALL_API_KEY=...
```

## Step 6: Run!
Click the green "Run" button in Replit

## 🎉 Done!
- Your app: `https://YOUR-REPL-NAME.YOUR-USERNAME.repl.co`
- Admin login: `https://YOUR-REPL-NAME.YOUR-USERNAME.repl.co/login`

## Share Your Platform
Add this to your repo README:
```markdown
[![Run on Replit](https://replit.com/badge/github/YOUR_USERNAME/interview-platform)](https://replit.com/new/github/YOUR_USERNAME/interview-platform)
```

---

### Need Help?
- Full setup: [REPLIT_SETUP.md](REPLIT_SETUP.md)
- GitHub guide: [GITHUB_SETUP.md](GITHUB_SETUP.md)
- Platform docs: [README.md](README.md)