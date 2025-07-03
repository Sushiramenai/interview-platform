# AI-Powered Video Interview Platform

[![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/new/github/Sushiramenai/interview-platform)

A fully automated interview platform where an AI bot joins Google Meet and conducts video interviews with voice synthesis. Perfect for HR teams with limited technical experience.

**🎉 Now Fully Replit-Ready!** No manual configuration needed - the platform automatically detects and optimizes for Replit deployment.

## 🌟 Key Features

- **AI Bot Interviewer**: Self-hosted bot joins Google Meet and speaks questions
- **Voice Synthesis**: Natural voice using ElevenLabs
- **One-Click Setup**: Deploy on Replit in minutes
- **HR-Friendly**: No technical knowledge required
- **Cost-Effective**: ~$0.11 per interview (vs $1000s/month for alternatives)
- **Multiple Modes**: AI bot, manual, or premium recording options

## 🚀 Quick Start for HR Teams

### Deploy in 3 Minutes:

1. **Click Deploy Button**
   [![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/new/github/Sushiramenai/interview-platform)

2. **Sign up/Login to Replit**
   - Use Google or email
   - Free account works!

3. **Click the Green "Run" Button**
   - Wait 2-3 minutes for setup
   - Your platform is ready!

### Access Your Platform:
- **Admin Login**: `your-replit-url/login`
  - Username: `Admin`
  - Password: `admin123`

### First-Time Setup (5 minutes):
1. Login to admin panel
2. Go to "API Configuration"
3. Add 3 API keys (we'll show you how)
4. Start interviewing!

## 💰 Cost Comparison

| Service | Monthly Cost | Per Interview |
|---------|-------------|---------------|
| Recall.ai | $500-2000 | ~$10-20 |
| HireVue | $1000+ | ~$15-25 |
| **Our Platform** | **$0-7** | **~$0.11** |

### What You Pay:
- **Hosting**: $0 (Replit free) or $7 (Replit Hacker)
- **APIs**: ~$0.11 per interview
- **Total**: Under $50/month for hundreds of interviews!

## 📋 Required API Keys (One-Time Setup)

### 1. Claude AI ($0)
- Go to: https://console.anthropic.com/
- Sign up → Create API key
- Free tier available

### 2. Google Service Account ($0)
- See our [Google Setup Guide](VIDEO_INTERVIEW_FLOW.md#getting-google-api)
- Enables Google Meet creation

### 3. ElevenLabs ($0)
- Go to: https://elevenlabs.io/
- Sign up → Get API key
- Free tier = 10,000 characters/month

## 👥 How HR Uses It

### Daily Workflow:
1. **Create Role**
   - Click "Role Templates"
   - Add questions for the position
   - Save

2. **Share Link**
   - Copy interview URL
   - Send to candidates

3. **Review Results**
   - Check "Candidate Results"
   - See scores and evaluations

### What Candidates Experience:
1. Click interview link
2. Enter name/email
3. Join Google Meet
4. AI bot joins and asks questions
5. Complete interview
6. Done!

## 🤖 How the AI Bot Works

1. **Candidate joins Google Meet**
2. **AI bot launches** (10 seconds later)
3. **Bot introduces itself** with voice
4. **Asks each question** using ElevenLabs
5. **Waits for responses** (30-45 seconds)
6. **Concludes interview** professionally
7. **Auto-evaluates** and saves results

## 🎯 3 Interview Modes

### 1. **Self-Hosted AI Bot** (Recommended)
- Requirements: Claude + Google + ElevenLabs
- AI bot joins Meet and speaks
- No recording
- Cost: ~$0.11/interview

### 2. **Manual Mode** (Fallback)
- Requirements: Claude + Google only
- Human conducts with interview guide
- No bot needed
- Cost: ~$0.01/interview

## ❓ Common HR Questions

**Q: Do I need technical knowledge?**
A: No! Everything is click-based. If you can use email, you can use this.

**Q: What if the bot doesn't work?**
A: System auto-switches to manual mode with interview guide.

**Q: Is it really that cheap?**
A: Yes! You only pay for API usage, about 11 cents per interview.

**Q: Can we customize questions?**
A: Yes! Unlimited roles and questions through the dashboard.

**Q: Is it secure?**
A: Yes! Each interview has unique links, one-time use only.

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step Replit setup
- **[AI Bot System](AI_BOT_SYSTEM.md)** - How the bot works
- **[Google Setup](VIDEO_INTERVIEW_FLOW.md)** - Getting Google credentials
- **[Integration Status](INTEGRATION_STATUS.md)** - Current features

## 🆘 Need Help?

### Quick Fixes:
- **Can't login?** Check caps lock (Username: Admin)
- **Bot not joining?** Upgrade to Replit Hacker plan
- **API errors?** Double-check your keys in settings
- **"Error saving API keys"?** See [FIXES_APPLIED.md](FIXES_APPLIED.md)

### Support:
- Create an [Issue](https://github.com/Sushiramenai/interview-platform/issues)
- Check [Deployment Guide](DEPLOYMENT_GUIDE.md)
- Review [Documentation](#-documentation)

## 🎉 Ready to Start?

1. Click the Replit button at the top
2. Follow our [5-minute setup](DEPLOYMENT_GUIDE.md)
3. Start interviewing today!

---

**Built to make hiring affordable and accessible for everyone!** 🚀