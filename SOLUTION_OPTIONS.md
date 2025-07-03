# Solution Options for API Save and Interview Start Issues

## Issue 1: "Error saving API keys"

### Option A: Direct Database Setup (Easiest) ✅
**Cost: $0 | Time: 2 minutes**

Run this command:
```bash
node setup-api-keys.js
```

This interactive script bypasses the web UI entirely and saves keys directly to the database.

### Option B: Environment Variables (Traditional) 
**Cost: $0 | Time: 5 minutes**

1. Create a `.env` file:
```env
CLAUDE_API_KEY=your-claude-key
GOOGLE_CREDENTIALS={"type":"service_account",...}
ELEVENLABS_API_KEY=your-elevenlabs-key
```

2. Update `src/utils/service_initializer.js` to check environment variables first

### Option C: Manual Config File
**Cost: $0 | Time: 3 minutes**

1. Edit `data/config.json` directly:
```json
{
  "initialized": true,
  "apiKeys": {
    "CLAUDE_API_KEY": "your-key",
    "GOOGLE_CREDENTIALS": "{...}",
    "ELEVENLABS_API_KEY": "your-key"
  }
}
```

2. Restart the server

## Issue 2: "Failed to start interview"

### Option A: Manual Interview Mode (Immediate) ✅
**Cost: $0 | Time: 0 minutes**

The system automatically falls back to manual mode if AI bot fails. This provides:
- Interview guide for human interviewer
- Google Meet link
- Structured questions
- Result tracking

### Option B: Simplified Bot Mode
**Cost: ~$0.05/interview | Time: 10 minutes**

Remove Google Meet integration, use simple voice call:
1. Use Twilio for voice calls ($0.0085/min)
2. Stream ElevenLabs audio
3. Record with Twilio
4. Total cost: ~$0.05 per 30-min interview

### Option C: Text-Based Fallback
**Cost: $0.01/interview | Time: 5 minutes**

Revert to text-based chat interview:
- No voice synthesis needed
- No Google Meet required
- Just Claude AI for questions/evaluation
- Candidate types responses

## Recommended Approach

### For Immediate Fix (Today):
1. **Run `node setup-api-keys.js`** to bypass web UI issues
2. **Use manual mode** for interviews while debugging
3. **Check server logs** for specific errors

### For Long-term Solution:
1. **Implement Option A** for both issues
2. **Add retry logic** to API endpoints
3. **Create health check endpoint** for monitoring

## Quick Debug Commands

```bash
# Check if API keys are saved
node -e "const cm = require('./src/utils/config_manager'); cm.initialize().then(() => cm.getApiKeys()).then(console.log)"

# Test interview start directly
node test-interview-start.js

# View server logs
npm start 2>&1 | tee server.log
```

## Emergency Workarounds

### If Nothing Works:

1. **Super Simple Mode**:
   - Disable all API integrations
   - Use static Google Meet links
   - Manual evaluation
   - Cost: $0

2. **Hybrid Mode**:
   - Use Calendly for scheduling
   - Pre-recorded video questions
   - Candidate records video responses
   - Manual review
   - Cost: $10/month

3. **Third-Party Integration**:
   - Use Typeform for initial screening
   - Webhook to your platform
   - Manual Google Meet
   - Cost: $25/month

## Contact Support

If issues persist after trying these solutions:
1. Check server error logs
2. Verify all directories exist (`node verify-fixes.js`)
3. Ensure Node.js version 16+
4. Try incognito/private browser mode