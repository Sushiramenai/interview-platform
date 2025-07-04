# 🚀 START HERE - Simplified AI Interview Platform

## You Only Need These Files:

### Core Files (Required)
1. `simplified-server.js` - The entire backend
2. `simple-setup.js` - Easy setup wizard
3. `simplified-package.json` - Minimal dependencies
4. `/views/` folder - UI pages:
   - `hr-dashboard.html` - Main HR interface
   - `interview.html` - Interview room
   - `results.html` - View results

### That's It! 🎉

## Quick Start (3 Steps)

### 1. Copy Package File
```bash
cp simplified-package.json package.json
```

### 2. Run Setup
```bash
npm install
node simple-setup.js
```

### 3. Start Platform
```bash
npm start
```

Open: http://localhost:3000

## What This Does

- ✅ **AI Interviews**: Claude AI asks intelligent questions
- ✅ **Natural Voice**: ElevenLabs makes AI sound human
- ✅ **Video Recording**: Everything recorded automatically
- ✅ **Auto Scoring**: AI evaluates candidates (1-10 score)
- ✅ **Simple Dashboard**: Create interviews in seconds
- ✅ **No External Services**: Everything runs on your server

## Files You DON'T Need

The following can be DELETED - they're from the old complex system:

```
❌ /src/logic/* (except what's in views/)
❌ /src/bots/* 
❌ /src/utils/* 
❌ /src/middleware/*
❌ index.js (old server)
❌ All Google Meet related files
❌ All Puppeteer files
❌ Complex authentication files
```

## File Structure (Simplified)

```
your-folder/
├── simplified-server.js     # Main server (300 lines)
├── simple-setup.js         # Setup wizard
├── package.json           # Dependencies (5 packages)
├── .env                   # Your API keys (created by setup)
├── /views/
│   ├── hr-dashboard.html  # HR interface
│   ├── interview.html     # Interview room
│   └── results.html       # Results viewer
├── /public/               # Auto-created
└── /data/                # Auto-created
    ├── /recordings/      # Video recordings
    └── /results/         # Interview results
```

## For Non-Technical HR Users

1. **Create Interview**: Fill form, click button
2. **Share Link**: Copy/paste to candidate
3. **View Results**: Click to see scores, transcript, video

## API Keys Needed

1. **Claude** (Required): https://console.anthropic.com/
2. **ElevenLabs** (Optional): https://elevenlabs.io/

## Common Issues & Fixes

### "Cannot find module"
Run: `npm install`

### "API key not configured"
Run: `node simple-setup.js`

### "Port already in use"
Change PORT in .env file

### "No audio from AI"
Add ElevenLabs key or continue without voice

## Support

This simplified version is designed to "just work". If you have issues:

1. Make sure you're using the simplified files
2. Run setup again: `node simple-setup.js`
3. Use Chrome browser
4. Check API keys are correct

---

**Remember**: This is the SIMPLIFIED version. It does one thing well: AI-powered video interviews. No complexity, no confusion, just results! 🎯