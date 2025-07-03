# Replit API Save - Complete Fix

## The Error You Encountered
```
Saving Progress:
Saving ElevenLabs API... (2/3) ❌

⚠️ Some keys failed to save:
- Google Credentials: Unexpected token '<'
- ElevenLabs API: Unexpected token '<'
```

This error occurred because the server was returning HTML error pages instead of JSON responses.

## Root Cause
The `/api/config/key` endpoint was not properly accessible, causing the browser to receive HTML 404 pages when trying to save individual keys.

## The Solution

### 1. **Simplified Approach**
Instead of using a separate endpoint, we now use the existing batch endpoint but with single keys:
- Each key is sent individually to `/api/config/keys`
- Smaller payloads avoid timeouts
- 1-second delay between saves

### 2. **Better Error Handling**
The UI now:
- Detects HTML responses (checks content-type header)
- Provides clearer error messages
- Handles both JSON and non-JSON responses gracefully

### 3. **How It Works**
```javascript
// For each key on Replit:
const singleKeyObj = {};
singleKeyObj[keyName] = keyValue;

// Send just one key at a time
await fetch('/api/config/keys', {
    method: 'POST',
    body: JSON.stringify(singleKeyObj)
});
```

## What You'll See Now

When saving on Replit:
```
Saving Progress:
Saving Claude API... (1/3) ✅
Saving Google Credentials... (2/3) ✅
Saving ElevenLabs API... (3/3) ✅

✅ All keys saved successfully!
```

## If You Still Get Errors

Use the command-line fallback:
```bash
node setup-api-keys.js
```

This tool:
- Shows your current configuration
- Only asks for keys you want to update
- Saves directly without any web interface
- Never times out or returns HTML errors

## Technical Changes Made

1. **Removed dependency on `/api/config/key`** - Uses existing batch endpoint
2. **Added HTML error detection** - Checks content-type before parsing JSON
3. **Increased delay to 1 second** - More time between saves on Replit
4. **Simplified error messages** - Clearer feedback when saves fail

## Result

The system now reliably saves all 3 API keys on Replit without HTML parsing errors!