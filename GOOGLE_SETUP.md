# Google Meet Integration Setup

## Quick Setup for Replit

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your project ID

### Step 2: Enable Google Calendar API
1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### Step 3: Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in:
   - Service account name: `interview-platform-bot`
   - Service account ID: (auto-generated)
   - Description: "Bot for creating Google Meet rooms"
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

### Step 4: Generate Key
1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Click "Create" - a JSON file will download

### Step 5: Add to Interview Platform

**Option A: Using Admin Panel (on Replit)**
1. Open the downloaded JSON file in a text editor
2. Copy the ENTIRE contents
3. Go to your Replit app's `/admin` page
4. Login (username: `admin`, password: `admin123`)
5. Go to "API Configuration" tab
6. Paste the JSON into "Google Service Account JSON" field
7. Click "Save Google Credentials" button

**Option B: Using Setup Script**
1. In Replit Shell, run:
   ```bash
   node setup-api-keys.js
   ```
2. When prompted for Google credentials, choose 'y'
3. Paste the JSON content
4. Press Enter twice when done

### Step 6: Verify Setup
Run in Replit Shell:
```bash
node debug-api-keys.js
```

You should see:
```
Google Credentials: ✅ Set
```

### Troubleshooting

**"Save Google Credentials" gives 502 error:**
- The JSON file might be too large
- Use the setup script method instead
- Or use the direct save endpoint

**Still showing "Google Meet Setup Required":**
1. Restart the Replit
2. Check console for errors
3. Verify the JSON was valid
4. Make sure Calendar API is enabled

## Alternative: Use Without Google Meet

If you can't set up Google credentials, the interview can still work:

1. When you see "Google Meet Setup Required", click the link to create a manual Meet room
2. Copy the Meet URL
3. Share it with the candidate
4. Conduct the interview manually

The AI interviewer features require Google integration to work automatically.