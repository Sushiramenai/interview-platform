# AI Interview Platform - Simple & Powerful

A streamlined AI-powered interview platform that conducts professional job interviews using Claude AI and ElevenLabs voice synthesis. No external meeting platforms needed - everything runs in your browser\!

## 🚀 Quick Start on Replit

### 1. Fork on Replit
[\![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/github/Sushiramenai/interview-platform)

### 2. Setup (One Time Only)
Once your Repl is ready, click the Shell tab and run:
```bash
npm install
node simple-setup.js
```

You'll be asked for 2 API keys:
- **Claude API Key** (Required): Get from [console.anthropic.com](https://console.anthropic.com/)
- **ElevenLabs API Key** (Optional): Get from [elevenlabs.io](https://elevenlabs.io/)

### 3. Start the Platform
Click the green "Run" button or:
```bash
npm start
```

Your interview platform is now live at your Replit URL\!

## 💼 How It Works

### For HR/Recruiters:

1. **Create Interview**
   - Open your Replit app URL
   - Fill in candidate name, email, and role
   - Click "Create Interview Link"

2. **Share with Candidate**
   - Copy the generated link
   - Send via email or message
   - No downloads or installs needed

3. **Review Results**
   - Return to dashboard anytime
   - See all interviews and their status
   - Click "View Results" for completed interviews

### For Candidates:

1. Click the interview link
2. Allow camera/microphone when prompted
3. Meet your AI interviewer
4. Answer questions naturally
5. Interview completes automatically

## 🎯 Features

- **🤖 AI Interviewer**: Claude AI asks intelligent, role-specific questions
- **🎙️ Natural Voice**: ElevenLabs makes the AI sound human
- **📹 Video Recording**: Full interview recorded automatically
- **📝 Live Transcription**: Real-time speech-to-text
- **📊 Automatic Scoring**: AI evaluates candidates (1-10 scale)
- **📄 Detailed Reports**: Transcripts, strengths, improvements
- **🔒 Privacy First**: Everything stays on your server

## 📋 What You Get

### Interview Dashboard
- Create unlimited interviews
- Track all candidates
- Simple, clean interface

### AI-Powered Interviews
- 6 intelligent questions per interview
- Natural conversation flow
- Professional yet friendly tone

### Comprehensive Results
- Overall score (1-10)
- Performance summary
- Key strengths identified
- Areas for improvement
- Full transcript
- Video recording

## 💰 Costs

- **Claude AI**: ~$0.25 per interview
- **ElevenLabs**: Free tier includes 10 interviews/month
- **Total**: Less than $1 per interview

## 🛠️ Customization

### Change Interview Questions
Edit the questions array in `server.js`:
```javascript
this.questions = [
    "Your custom question here",
    "Another question",
    // ...
];
```

### Adjust AI Voice
Change the voice in `server.js`:
```javascript
this.voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Different voice ID
```

## 🔧 Troubleshooting

### "API key not configured"
Run `node simple-setup.js` again and enter your keys.

### "Camera/Microphone access denied"
Candidates need to allow permissions in their browser.

### "No audio from AI"
Make sure you added an ElevenLabs API key during setup.

### Port already in use
Change the PORT in your Replit environment variables.

## 📁 Project Structure

```
/
├── server.js              # Main application server
├── simple-setup.js        # Setup wizard
├── package.json          # Dependencies
├── .env                  # API keys (created by setup)
├── /views/
│   ├── hr-dashboard.html # HR interface
│   ├── interview.html    # Interview room
│   └── results.html      # Results viewer
├── /public/              # Static files (auto-created)
└── /data/               # Interview data (auto-created)
    ├── /recordings/     # Video recordings
    └── /results/        # Interview results
```

## 🌟 Why This Platform?

- **Simple**: No complex setup or external services
- **Fast**: Create interviews in seconds
- **Professional**: AI conducts consistent, unbiased interviews
- **Affordable**: Fraction of the cost of traditional solutions
- **Reliable**: Everything runs on your own server
- **Scalable**: Handle unlimited concurrent interviews

## 🤝 Support

- **Setup Issues**: Make sure you ran `node simple-setup.js`
- **Browser Issues**: Use Chrome for best results
- **API Issues**: Verify your keys are correct and have credits

## 📜 License

MIT License - Use freely for your recruiting needs\!

---

Built with ❤️ to make hiring easier, faster, and better.
EOF < /dev/null