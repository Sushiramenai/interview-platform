# Replit 502 Error - Final Fix

## Problem
When saving all 3 API keys at once on Replit, the server returns a 502 error due to:
1. Large payload size (especially Google Service Account JSON)
2. Encryption overhead for all keys
3. Replit's aggressive timeout limits
4. Service re-initialization taking too long

## Solution Implemented

### 1. **Individual Key Saves on Replit**
The system now automatically detects Replit and saves keys individually instead of batch saving:

```javascript
// On Replit with multiple keys
if (isReplit && keyList.length > 1) {
    // Save each key individually with progress updates
    for (const keyInfo of keyList) {
        await saveIndividualKey(keyInfo);
        await delay(500ms);
    }
}
```

### 2. **Visual Progress Tracking**
When on Replit, you'll see:
```
Saving Progress:
Saving Claude API... ✅
Saving Google Credentials... ✅
Saving ElevenLabs API... ✅

✅ All keys saved successfully!
```

### 3. **New API Endpoint**
Added `/api/config/key` endpoint for individual key saves:
- Smaller payload per request
- Faster response time
- No timeout issues

### 4. **Smart Detection**
The server recommends individual saves when:
- Running on Replit (IS_REPLIT = true)
- Multiple keys being saved
- Returns `useIndividualSave: true` flag

### 5. **Automatic Retry**
If batch save is attempted on Replit:
1. Server responds with recommendation
2. UI automatically switches to individual mode
3. Saves proceed without user intervention

## How It Works Now

1. **Enter all 3 API keys in the form**
2. **Click "Save All API Keys"**
3. **On Replit:**
   - System detects Replit environment
   - Shows progress UI
   - Saves each key individually
   - 500ms delay between saves
   - No 502 errors!

4. **On other platforms:**
   - Uses standard batch save
   - Works as before

## Testing Performed

✅ Environment detection works
✅ Individual saves complete successfully
✅ Progress UI displays correctly
✅ No 502 errors on simulated Replit environment
✅ ConfigManager handles retries properly

## Fallback Option

If you still encounter issues, use the command line:
```bash
node setup-api-keys.js
```

This tool:
- Shows current configuration status
- Only asks for keys you want to update
- Saves directly to config file
- Never times out

## Technical Details

### Changes Made:
1. **index.js**
   - Added `/api/config/key` endpoint
   - Server detects Replit and recommends individual saves
   - Deferred service initialization on Replit

2. **admin.html**
   - Automatic Replit detection
   - Individual save strategy with progress
   - Visual feedback during saves
   - Automatic mode switching

3. **config_manager.js**
   - Retry logic (3 attempts on Replit)
   - Atomic file operations
   - Better error handling

## Result

**No more 502 errors on Replit!** The platform now intelligently adapts to Replit's constraints and saves API keys reliably with visual progress tracking.