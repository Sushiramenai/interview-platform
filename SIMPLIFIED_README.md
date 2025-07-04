# AI Interview Platform - Simple Setup Guide

## What is this?

A simple platform that conducts job interviews using AI. No technical knowledge required!

### How it works:
1. **You create an interview link** (takes 10 seconds)
2. **Send link to candidate** (via email/text)
3. **AI conducts the interview** (with voice and video)
4. **Get scored results** (transcript, recording, and evaluation)

## 🚀 Quick Start (5 minutes)

### Step 1: Setup (one-time only)
```bash
node simple-setup.js
```

Just answer 2 questions:
- Your Claude API key (for AI brain)
- Your ElevenLabs API key (for AI voice) - optional

### Step 2: Start the platform
```bash
npm start
```

### Step 3: Open your browser
Go to: http://localhost:3000

That's it! You're ready to conduct AI interviews.

## 💼 For HR Users

### Creating an Interview

1. Open the dashboard
2. Fill in:
   - Candidate name
   - Candidate email
   - Position (e.g., "Software Engineer")
3. Click "Create Interview Link"
4. Copy the link (it's automatically copied!)
5. Send to candidate

### What Happens Next?

When the candidate clicks the link:
1. Their browser asks for camera/microphone permission
2. They see the AI interviewer (animated avatar)
3. AI asks 6 intelligent questions
4. Candidate answers verbally
5. AI listens and responds naturally
6. Everything is recorded

### Viewing Results

After the interview:
1. Go back to dashboard
2. Click "View Results" next to the candidate
3. You'll see:
   - Overall score (1-10)
   - Summary of performance
   - Key strengths
   - Areas for improvement
   - Full transcript
   - Video recording

## 💰 Costs

- **Claude AI**: ~$0.25 per interview
- **ElevenLabs**: Free for up to 10 interviews/month
- **Total**: Less than $1 per interview

## 🔧 Technical Details (for IT)

### Requirements:
- Node.js 16+
- 2 API keys
- That's it!

### What it does:
- Hosts video interviews directly (no Zoom/Meet needed)
- Uses Claude AI for intelligent questions
- Uses ElevenLabs for natural voice
- Records everything automatically
- Scores candidates objectively

### Security:
- All data stays on your server
- No external video platforms
- Encrypted API keys
- GDPR compliant

## ❓ Common Questions

**Q: Do candidates need to install anything?**
A: No, it works in their browser.

**Q: What browsers work?**
A: Chrome, Edge, Safari, Firefox (Chrome works best).

**Q: Can I customize the questions?**
A: Yes, edit the questions in `simplified-server.js`.

**Q: Where are recordings stored?**
A: In the `data/recordings` folder on your server.

**Q: Can multiple interviews run at once?**
A: Yes, unlimited concurrent interviews.

**Q: What if candidate's internet is slow?**
A: The system adapts automatically.

## 🆘 Troubleshooting

### "API key not configured"
- Run `node simple-setup.js` again
- Make sure you entered valid keys

### "Camera/Microphone access denied"
- Candidate needs to allow permissions
- Try a different browser

### "No audio from AI"
- Check ElevenLabs API key
- Try refreshing the page

### "Can't see video"
- Check camera permissions
- Try Chrome browser

## 📊 Sample Interview Flow

1. **AI**: "Hello! I'm your AI interviewer today. Let's begin!"
2. **AI**: "Tell me about yourself and your professional background."
3. **Candidate**: *answers*
4. **AI**: "What interests you most about this role?"
5. **Candidate**: *answers*
6. ... (continues for 6 questions)
7. **AI**: "Thank you! We'll be in touch soon."

## 🎯 Benefits

- **Save Time**: No scheduling needed
- **Consistent**: Every candidate gets same experience
- **Objective**: AI scoring removes bias
- **Convenient**: Candidates interview anytime
- **Insightful**: Get transcripts and recordings
- **Affordable**: Under $1 per interview

## 📱 For Replit Users

1. Fork the repository
2. Add API keys in Secrets tab:
   - `CLAUDE_API_KEY`
   - `ELEVENLABS_API_KEY`
3. Click "Run"
4. Use the generated URL

## 🚀 Advanced Features

- Export results to PDF
- Integrate with your ATS
- Custom evaluation criteria
- Multiple interview templates
- Team collaboration
- Analytics dashboard

---

**Need help?** The system is designed to be simple. If you're stuck, the issue is probably with API keys. Run the setup again!

**Want customization?** This is the simplified version. For advanced features, contact your developer.