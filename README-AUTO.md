# Senbird Interview System - Auto Setup for Replit

A streamlined AI-powered interview system by Senbird that works immediately on Replit with zero configuration!

## 🚀 Instant Setup on Replit

### 1. Fork on Replit
[![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/github/Sushiramenai/interview-platform)

### 2. Add Your API Keys
Click the 🔒 **Secrets** button in Replit and add:
- **CLAUDE_API_KEY**: Get from [console.anthropic.com](https://console.anthropic.com/) (Required)
- **ELEVENLABS_API_KEY**: Get from [elevenlabs.io](https://elevenlabs.io/) (Optional for voice)

### 3. Click Run
That's it! The platform will automatically:
- ✅ Detect it's running on Replit
- ✅ Install all dependencies
- ✅ Create necessary directories
- ✅ Configure environment
- ✅ Start the server
- ✅ Show your app URL

**No manual commands needed!** 🎉

## 💼 How It Works

Once running, you'll see:
```
🚀 Senbird Interview System is running!

🔗 Your app URL: https://your-repl-name.your-username.repl.co
```

### For HR/Recruiters:

1. **Open the URL** shown in your Replit console
2. **Create Interview**: Fill in candidate details, get instant link
3. **Share Link**: Send to candidate (no installs needed)
4. **View Results**: See scores, transcript, and recording

### For Candidates:

1. Click interview link
2. Allow camera/microphone
3. Answer AI interviewer's questions
4. Done! Results sent to HR

## 🎯 Features

- **🤖 AI Interviewer**: Claude AI asks intelligent questions
- **🎙️ Natural Voice**: ElevenLabs makes AI sound human
- **📹 Auto Recording**: Everything saved automatically
- **📊 Instant Scoring**: 1-10 evaluation with feedback
- **📝 Full Transcript**: Every word captured
- **🔒 Privacy First**: Data stays on your server

## 🔧 If You Need to Customize

The auto-start script handles everything, but if you want to:

### Change Questions
Edit `server.js` and modify the questions array

### Use Different Voice
Change the voiceId in `server.js`

### Manual Setup (Not Needed on Replit)
```bash
npm install
node simple-setup.js
node server.js
```

## 💰 Costs

- Claude: ~$0.25 per interview
- ElevenLabs: Free tier = 10 interviews/month
- **Total: Less than $1 per interview**

## 🆘 Troubleshooting

### "Claude API key required"
Add CLAUDE_API_KEY to Replit Secrets (🔒 button)

### "No audio from AI"
Add ELEVENLABS_API_KEY to Replit Secrets (optional)

### "Can't see my app"
Check the Webview panel or console for your URL

## 🚀 That's It!

Your Senbird Interview System is ready to use. No configuration files, no manual setup, just add API keys and click Run!

Perfect for HR teams who want powerful AI interviews without any technical complexity.