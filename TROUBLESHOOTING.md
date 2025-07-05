# Troubleshooting: Interview Not Starting

## Common Issues and Solutions

### 1. Silent Interview Room (No Greeting)

**Symptoms:**
- Join interview room
- Camera/mic permissions granted
- But no AI greeting plays

**Check These:**

1. **Browser Console** (F12)
   - Look for `🤖 AI speaks event received`
   - Check for any red error messages
   - Look for `Connected to server`

2. **Server Console**
   - Look for `[Join Interview] Getting greeting for interview`
   - Check for OpenAI API errors
   - Look for `Audio generation failed`

### 2. API Key Issues

**OpenAI API Key:**
```bash
# Check if configured
grep "openai_api_key" config.json

# Test directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**ElevenLabs API Key (optional):**
```bash
# If audio generation fails, interview continues without voice
# Check server logs for: "Audio generation failed"
```

### 3. Quick Diagnostics

**Step 1: Test Socket Connection**
1. Open browser console
2. Should see: `✅ Connected to server`
3. Should see: `Joining interview with ID: xxx`

**Step 2: Check Event Flow**
Server should log:
```
Interview session started: { interviewId: 'xxx', ... }
[Join Interview] Getting greeting for interview xxx
[Join Interview] Greeting response: { type: 'greeting', ... }
[Join Interview] ai-speaks event emitted for greeting
```

Client should log:
```
🤖 AI speaks event received: { type: 'greeting', ... }
📊 Interview info received: { totalQuestions: 4, ... }
```

**Step 3: Test Without Audio**
If no audio but text appears:
- Check ElevenLabs API key
- System works without audio (text-only)
- Speech recognition should still start after 2 seconds

### 4. Debug Mode

**Use Test Page:**
```
http://localhost:3000/test-interview/YOUR_INTERVIEW_ID
```

This shows:
- Connection status
- All events received
- Manual controls to test flow

### 5. Common Fixes

**No Events Received:**
```javascript
// Check interview ID is valid
// In browser console:
console.log(interviewId);  // Should not be undefined
```

**Audio Not Playing:**
```javascript
// Test browser audio
new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGVzvLZgS0HGm7A7OC...').play();
```

**Speech Recognition Not Starting:**
- Check microphone permissions
- Look for `🎤 Starting speech recognition` in console
- Try clicking in the window to trigger user interaction

### 6. Manual Testing

**Test AI Orchestrator:**
```bash
# Set your API key
export OPENAI_API_KEY="your-key"

# Run test
node test-interview-scenarios.js
```

**Test Socket Connection:**
```bash
node debug-interview.js YOUR_INTERVIEW_ID
```

### 7. Server Restart

Sometimes a clean restart helps:
```bash
# Stop server (Ctrl+C)
# Clear any temp files
rm -rf node_modules/.cache

# Restart
npm start
```

### 8. Check System Health

```bash
node system-health-check.js
```

Should show:
- ✅ Configuration clean
- ✅ AI Orchestrator file exists
- ✅ Optimal interview settings configured

### 9. If Nothing Works

1. **Check Network Tab** (F12 → Network)
   - Look for WebSocket connection
   - Should show `101 Switching Protocols`

2. **Try Different Browser**
   - Chrome/Edge work best
   - Safari may have audio issues

3. **Check Firewall**
   - Port 3000 should be accessible
   - WebSocket connections allowed

### 10. Enable Maximum Logging

Add to top of server.js:
```javascript
process.env.DEBUG = '*';
```

This will show all socket.io communication.

## Still Having Issues?

1. Create a new interview fresh
2. Copy the interview ID
3. Open in incognito/private window
4. Check both browser and server consoles
5. Note the first error that appears

The issue is usually:
- Missing/invalid API keys (most common)
- WebSocket connection blocked
- Browser permissions denied
- Interview already completed (single-use links)