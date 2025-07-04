# Senbird Interview System - Simple & Powerful

A streamlined AI-powered interview system by Senbird that conducts professional job interviews using OpenAI GPT-4 and ElevenLabs voice synthesis. Features customizable interview templates, in-app API configuration, and private AI evaluations. No external meeting platforms needed - everything runs in your browser!

## 🚀 Quick Start on Replit

### 1. Fork on Replit
[\![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/github/Sushiramenai/interview-platform)

### 2. Setup
Once your Repl is ready:

**Option A: Use the Settings UI (Recommended)**
1. Start the server: `npm start`
2. Open your app and click the settings icon (⚙️) in the top right
3. Enter your API keys:
   - **OpenAI API Key** (Required): Get from [platform.openai.com](https://platform.openai.com/)
   - **ElevenLabs API Key** (Optional): Get from [elevenlabs.io](https://elevenlabs.io/)
4. Click "Save Settings"

**Option B: Use Environment Variables**
Set these in Replit Secrets:
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

### 3. Start the Platform
Click the green "Run" button or:
```bash
npm start
```

Your interview platform is now live at your Replit URL\!

## 💼 How It Works

### For HR/Recruiters:

1. **Create Interview Templates**
   - Click "Manage Templates" to create role-specific templates
   - Add custom questions for each position
   - Templates appear in the position dropdown

2. **Schedule Interviews**
   - Select a position template from dropdown
   - Fill in candidate details
   - Choose AI voice (6 options available)
   - Customize questions if needed
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

- **🤖 AI Interviewer**: OpenAI GPT-4 conducts natural, conversational interviews
- **📋 Interview Templates**: Create reusable templates for different positions
- **🎙️ Voice Selection**: Choose from 6 professional AI voices
- **🎤 Voice-First**: Candidates speak naturally, AI responds with voice
- **📹 Video Recording**: Full interview recorded automatically
- **📝 Live Transcription**: Real-time speech-to-text
- **📊 Private Scoring**: AI evaluations visible only to HR (not candidates)
- **📄 Detailed Reports**: Transcripts, strengths, improvements
- **⚙️ Easy Configuration**: Built-in settings UI for API keys
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

- **OpenAI GPT-4**: ~$0.30-0.50 per interview
- **ElevenLabs**: Free tier includes 10 interviews/month
- **Total**: Less than $1 per interview

## 🛠️ Customization

### Manage Interview Templates
1. Click "Manage Templates" in the HR dashboard
2. Create templates for different positions
3. Add custom questions for each role
4. Templates automatically appear in the position dropdown

### Change Default Questions
Edit the default questions array in `server.js`:
```javascript
this.defaultQuestions = [
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
Click the settings icon (⚙️) in the HR dashboard and enter your API keys.

### "Camera/Microphone access denied"
Candidates need to allow permissions in their browser.

### "No audio from AI"
Make sure you added an ElevenLabs API key during setup.

### Port already in use
Change the PORT in your Replit environment variables.

## 📁 Project Structure

```
/
├── server.js              # Main server with OpenAI integration
├── package.json          # Dependencies
├── config.json          # API keys (created via settings)
├── .gitignore           # Excludes sensitive files
├── /views/
│   ├── hr-dashboard.html # HR interface with templates
│   ├── interview.html    # Voice-enabled interview room
│   └── results.html      # Results viewer (HR only)
├── /public/              
│   ├── /css/            # Modern design system
│   └── /images/         # Senbird logo
└── /data/               # Interview data (auto-created)
    ├── /recordings/     # Video recordings
    ├── /results/        # Interview results
    └── /templates/      # Interview templates
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

Built with ❤️ by Senbird to make hiring easier, faster, and better.

## 🆕 Latest Updates

- **OpenAI GPT-4 Integration**: More natural, conversational interviews
- **Interview Templates**: Create and reuse position-specific templates
- **In-App Settings**: Configure API keys without touching code
- **Voice Selection**: Choose from 6 professional voices
- **Private Evaluations**: Scores shown only to HR, not candidates
- **Enhanced UI**: Modern design with Senbird branding
EOF < /dev/null