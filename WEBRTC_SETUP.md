# WebRTC Interview Mode Setup

## Overview

The WebRTC Interview Mode allows you to conduct AI-powered interviews without needing Google Meet or any external video platform. Everything runs directly in the browser using WebRTC technology.

## Features

- 🎥 **Built-in Video/Audio**: No external meeting platforms needed
- 🤖 **AI Interviewer**: Claude AI conducts intelligent interviews
- 🎙️ **Natural Voice**: ElevenLabs provides realistic AI speech
- 📝 **Live Transcription**: Real-time speech-to-text
- 💾 **Recording**: Automatic interview recording
- 🚀 **Replit Optimized**: Works perfectly on free Replit tier

## Quick Setup

### 1. Enable WebRTC Mode

Run this command in your Replit Shell:
```bash
node enable-webrtc-mode.js
```

This will:
- Configure your environment for WebRTC
- Create necessary directories
- Update server configuration
- Enable the new interview mode

### 2. Install Dependencies

```bash
npm install socket.io
```

### 3. Configure API Keys

You only need 2 API keys (no Google required!):

```bash
node setup-api-keys.js
```

Enter:
- **Claude API Key**: For AI interview logic
- **ElevenLabs API Key**: For AI voice

### 4. Start the Server

```bash
npm run dev
```

## How It Works

### For Candidates:

1. Visit `/candidate?role=your_role`
2. Enter name and email
3. Click "Start Interview"
4. Browser opens the interview room
5. AI interviewer appears and starts speaking
6. Candidate answers questions verbally
7. AI responds intelligently to answers
8. Interview completes automatically

### Interview Flow:

1. **Connection**: WebRTC establishes peer connection
2. **Introduction**: AI greets candidate with voice
3. **Questions**: Asked one at a time with voice
4. **Listening**: Speech recognition captures responses
5. **Analysis**: Claude AI analyzes answers
6. **Follow-ups**: Dynamic questions based on responses
7. **Recording**: Full session recorded for review

## Technical Architecture

```
Browser (Candidate)
    ↓
WebRTC Connection
    ↓
Socket.io Server
    ↓
AI Services:
├── Claude AI (Interview Logic)
├── ElevenLabs (Voice Synthesis)
└── Web Speech API (Recognition)
```

## API Endpoints

- `GET /interview/:sessionId` - Interview room page
- WebSocket events via Socket.io:
  - `join-interview` - Candidate joins
  - `candidate-response` - Speech transcribed
  - `ai-question` - AI asks question
  - `interview-ended` - Session complete

## Features in Detail

### 1. AI Interview Intelligence
- Dynamic question flow
- Intelligent follow-ups
- Response analysis
- Natural conversation

### 2. Voice Synthesis
- Natural AI voice
- Multiple voice options
- Real-time streaming
- Emotion and tone

### 3. Speech Recognition
- Browser-based (no API needed)
- Real-time transcription
- Multiple language support
- Automatic silence detection

### 4. Recording & Playback
- Full video/audio recording
- Automatic storage
- Playback interface
- Export capabilities

## Customization

### Change AI Voice
Edit `webrtc-interview-server.js`:
```javascript
voice: 'rachel', // Change to: josh, bella, adam, etc.
```

### Adjust Interview Timing
```javascript
setTimeout(() => {
    this.askNextQuestion(sessionId, socket);
}, 3000); // Change delay between questions
```

### Custom Question Logic
Modify the `generateAIResponse` method to change how AI responds to answers.

## Troubleshooting

### "Camera/Microphone Access Denied"
- Browser requires HTTPS or localhost
- Grant permissions when prompted
- Check browser settings

### "Speech Recognition Not Working"
- Use Chrome or Edge (best support)
- Speak clearly near microphone
- Check browser console for errors

### "AI Voice Not Playing"
- Verify ElevenLabs API key
- Check browser autoplay policies
- Ensure speakers/headphones connected

### "Connection Failed"
- Ensure Socket.io is installed
- Check firewall settings
- Verify server is running

## Advantages Over Google Meet

1. **No External Dependencies**: Everything runs in your app
2. **Full Control**: Customize every aspect
3. **Better Integration**: Direct access to audio/video streams
4. **Cost Effective**: No Google Cloud costs
5. **Privacy**: Data stays in your system
6. **Reliability**: No external service outages

## Performance Tips

1. **Use Chrome/Edge**: Best WebRTC support
2. **Good Internet**: Stable connection recommended
3. **Close Other Tabs**: Reduce CPU usage
4. **Use Headphones**: Prevent echo/feedback

## Security Considerations

- WebRTC uses encrypted connections
- No video/audio leaves your server
- Recordings stored locally
- API keys encrypted in storage

## Future Enhancements

- [ ] Multiple interviewers
- [ ] Screen sharing
- [ ] Whiteboard feature
- [ ] Code editor integration
- [ ] Advanced analytics
- [ ] Mobile app support

## Support

If you encounter issues:
1. Check browser console
2. Verify API keys
3. Run `node debug-api-keys.js`
4. Check Socket.io connection
5. Review server logs

The WebRTC mode eliminates all Google Meet complexity while providing a superior interview experience!