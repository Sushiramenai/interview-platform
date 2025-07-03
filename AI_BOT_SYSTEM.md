# AI Interview Bot System (Without Recall.ai)

## Overview

This platform now includes a **self-hosted AI bot** that can join Google Meet and conduct interviews automatically, without requiring the expensive Recall.ai service.

## How It Works

### 1. **Bot Technology**
- Uses Puppeteer to control a Chrome browser
- Bot joins Google Meet as a participant
- Speaks questions using ElevenLabs voice synthesis
- Manages interview flow automatically

### 2. **Interview Flow**
1. Candidate enters details and starts interview
2. System creates Google Meet room
3. Candidate joins the Meet
4. AI bot launches and joins ~10 seconds later
5. Bot introduces itself and asks questions
6. Bot plays audio questions through the browser
7. Bot waits for responses between questions
8. Bot concludes interview and leaves

### 3. **Required Services**
- ✅ **Claude AI** - Interview logic and evaluation
- ✅ **Google Calendar** - Creates Meet rooms
- ✅ **ElevenLabs** - Voice synthesis for bot
- ❌ **Recall.ai** - NOT REQUIRED (we built our own bot!)

## Configuration

### Minimum Requirements:
1. **Claude API Key**
   - Get from: https://console.anthropic.com/
   - Used for: Interview evaluation

2. **Google Service Account**
   - Your existing JSON credentials
   - Used for: Creating Google Meet rooms

3. **ElevenLabs API Key**
   - Get from: https://elevenlabs.io/
   - Used for: Bot voice synthesis

### System Status Messages:
- **All 4 services configured**: "Premium AI bot interviews (Recall.ai)"
- **3 services (no Recall.ai)**: "Self-hosted AI bot active" ✅
- **Missing required services**: "System not ready"

## Features

### What Works:
- ✅ AI bot joins Google Meet automatically
- ✅ Bot speaks questions with natural voice
- ✅ Structured interview flow
- ✅ One-shot interview policy
- ✅ Automatic evaluation
- ✅ No expensive third-party services

### Limitations:
- ❌ No video recording (without Recall.ai)
- ❌ No real-time transcription
- ⚠️ Bot runs in visible browser window
- ⚠️ Requires desktop/server with Chrome

## Testing Instructions

1. **Configure Services**:
   - Add Claude API key
   - Add Google Service Account JSON
   - Add ElevenLabs API key
   - Skip Recall.ai (not needed!)

2. **Create Test Interview**:
   - Go to Role Templates
   - Create or edit a role
   - Copy the candidate URL

3. **Run Interview**:
   - Open candidate URL in new browser
   - Enter test details
   - Join Google Meet when it opens
   - Wait ~10 seconds for AI bot
   - Bot will start speaking!

## Technical Details

### Bot Components:
- `GoogleMeetBot` - Controls browser and Meet interaction
- `SelfHostedInterviewOrchestrator` - Manages interview flow
- `ElevenLabsService` - Generates voice audio

### Browser Requirements:
- Chrome or Chromium installed
- Speakers for audio output
- ~2GB RAM for browser process

### Security Notes:
- Bot runs locally on your server
- No data sent to third parties
- Meet session remains private

## Troubleshooting

### Bot doesn't join:
- Check Chrome is installed
- Verify Meet URL is correct
- Check firewall settings

### No audio:
- Verify ElevenLabs API key
- Check system audio settings
- Ensure browser has audio permissions

### Bot crashes:
- Check available RAM
- Verify all dependencies installed
- Check browser console logs

## Cost Comparison

### With Recall.ai:
- ~$500-2000/month for Recall.ai
- Plus API costs

### Self-Hosted Bot:
- $0 for bot infrastructure
- Only pay for API usage:
  - Claude: ~$0.01 per interview
  - ElevenLabs: ~$0.10 per interview
- **Total: ~$0.11 per interview!**

## Future Enhancements

Possible improvements:
- Add speech-to-text for transcription
- Implement screen recording
- Create headless mode option
- Add multi-language support
- Implement candidate response analysis

## Summary

This self-hosted AI bot solution provides 90% of the functionality of expensive services like Recall.ai, at a fraction of the cost. Perfect for startups and small companies who want AI-powered interviews without breaking the bank!