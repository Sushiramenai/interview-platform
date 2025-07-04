# Interview Platform Setup Guide

## Quick Start

### 1. Configure API Keys

The platform requires API keys to function properly. Without them, interviews cannot start.

**Option A: Using the Setup Script (Recommended)**
```bash
node setup-api-keys.js
```

**Option B: Manual Configuration**
1. Navigate to `/admin` in your browser
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. Go to "API Configuration" tab
4. Enter your API keys:
   - **Claude API Key** (Required): Get from https://console.anthropic.com/
   - **ElevenLabs API Key** (Required): Get from https://elevenlabs.io/
   - **Google Credentials** (Optional): For Google Meet integration

### 2. Troubleshooting Common Issues

#### "Interview redirects back to welcome page"
**Cause**: API keys are not properly saved or Google credentials are missing.

**Solution**:
1. Run `node debug-api-keys.js` to check key status
2. If keys show as "Not set", use the setup script
3. The system will show clear instructions if Google Meet is not configured

#### "Failed to start interview" or 502 errors
**Cause**: Services taking too long to initialize on Replit.

**Solution**:
- Wait 30 seconds and try again
- The system now handles timeouts gracefully
- Check server logs for specific errors

#### "Check your meeting code" error
**Cause**: Google credentials not configured.

**Solution**:
- Configure Google credentials for automatic Meet creation
- Or use manual Meet setup (create room at meet.google.com/new)

### 3. Google Meet Integration (Optional)

To enable automatic Google Meet room creation:

1. Create a Google Cloud project
2. Enable Calendar API
3. Create a service account
4. Download the JSON credentials
5. Add credentials using the setup script or admin panel

Without Google integration, the system will provide instructions for manual Meet setup.

### 4. Verify Setup

Run the diagnostic tool to ensure everything is configured:
```bash
node debug-api-keys.js
```

You should see:
- ✅ Claude API Key: Set
- ✅ ElevenLabs API Key: Set
- ✅ Google Credentials: Set (optional)

## What Happens During Interview Start

1. User enters name and email
2. System checks if interview was already attempted
3. Creates interview session
4. If Google is configured: Creates Meet room automatically
5. If Google is NOT configured: Shows manual setup instructions
6. Opens Meet room (or shows instructions)
7. AI interviewer joins after 10 seconds (if configured)

## API Key Security

- Keys are encrypted before storage
- Never commit API keys to version control
- Use environment variables in production
- Keys are stored in `data/config.json` (encrypted)

## For Replit Users

The platform is optimized for Replit's constraints:
- 30-second timeout handling
- Fast initialization
- Graceful fallbacks
- Clear error messages

If you encounter issues on Replit:
1. Ensure all dependencies are installed
2. Wait for full initialization (can take 30-60 seconds first time)
3. Check the Replit console for errors
4. Use the diagnostic tools provided