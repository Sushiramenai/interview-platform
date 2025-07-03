# Fix for "Error saving API keys"

## The Issue
The API keys are testing successfully but failing to save. This is typically due to:
1. Authentication cookie not being sent with the request
2. Session expiring
3. CORS/cookie settings in production environments

## Quick Fix

### Option 1: Logout and Login Again
1. Click "Logout" in the admin panel
2. Login again with Admin/admin123
3. Try saving API keys immediately after login

### Option 2: Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Try saving API keys
4. Look for any red error messages
5. Share the error message for specific help

### Option 3: Manual Save (Temporary Workaround)

If you need to get running immediately, you can manually save the API keys:

1. In your Replit, create a file called `setup-keys.js`:

```javascript
const ConfigManager = require('./src/utils/config_manager');

async function setupKeys() {
  const configManager = new ConfigManager();
  await configManager.initialize();
  
  // Replace these with your actual API keys
  await configManager.setApiKey('CLAUDE_API_KEY', 'your-claude-key-here');
  await configManager.setApiKey('GOOGLE_CREDENTIALS', `your-google-json-here`);
  await configManager.setApiKey('ELEVENLABS_API_KEY', 'your-elevenlabs-key-here');
  
  console.log('✅ API keys saved!');
}

setupKeys();
```

2. Run it in the Shell tab:
```bash
node setup-keys.js
```

3. Delete the file after running (for security)

## Permanent Fix (For Replit)

Add this to your `.replit` file:

```
[env]
REPL_SLUG = "$REPL_SLUG"
REPL_OWNER = "$REPL_OWNER"

[[ports]]
localPort = 3000
externalPort = 80

[web]
sameOriginOnly = false
```

This ensures cookies work properly in Replit's environment.

## If Still Having Issues

1. **Check Replit Secrets**: Make sure SESSION_SECRET is set
2. **Clear Browser Data**: Clear cookies for your Replit domain
3. **Use Different Browser**: Try Chrome/Firefox in incognito mode
4. **Check Server Console**: Look for authentication errors

## Why This Happens

- Replit uses a proxy that can interfere with cookies
- Session cookies might not persist properly
- CORS settings can block credentials

The manual setup method bypasses all these issues by directly writing to the config file.