# Replit Setup Guide for Interview Platform

## Quick Start on Replit

### 1. Import to Replit
1. Go to [Replit](https://replit.com)
2. Click "Create Repl"
3. Choose "Import from GitHub"
4. Paste your repository URL
5. Click "Import from GitHub"

### 2. Configure Environment Variables
In your Replit project, go to "Secrets" (🔐 icon) and add:

#### Required Secrets:
```
# Claude API
CLAUDE_API_KEY=your-claude-api-key

# Google APIs (for Calendar/Meet)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GOOGLE_CALENDAR_ID=primary
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id

# ElevenLabs (for AI voice)
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Recall.ai (for recording)
RECALL_API_KEY=your-recall-api-key

# Admin Authentication
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
SESSION_SECRET=your-session-secret-minimum-32-chars

# Replit Configuration
BASE_URL=https://your-repl-name.your-username.repl.co
PORT=3000
NODE_ENV=production
```

### 3. Google Cloud Setup

#### Create Service Account:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   - Google Calendar API
   - Google Drive API
4. Create Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key
   - Copy email and private key to Replit secrets

#### Set up Calendar:
1. Share your Google Calendar with the service account email
2. Give it "Make changes to events" permission

### 4. ElevenLabs Setup
1. Sign up at [ElevenLabs](https://elevenlabs.io)
2. Get your API key from Profile Settings
3. Choose a voice ID (Rachel recommended: 21m00Tcm4TlvDq8ikWAM)

### 5. Recall.ai Setup
1. Sign up at [Recall.ai](https://recall.ai)
2. Get your API key
3. Configure webhook URL: `https://your-repl-name.your-username.repl.co/api/webhooks/recall`

### 6. Run the Platform
1. Click "Run" in Replit
2. Wait for dependencies to install
3. Access your platform at the provided URL

## Usage

### Admin Access
1. Navigate to: `https://your-repl-url/login`
2. Login with your configured admin credentials
3. Access dashboard at: `https://your-repl-url/admin`

### Sharing Interview Links
Share links in this format:
```
https://your-repl-url/?role=customer_support&id=unique-candidate-id
```

## Troubleshooting

### Google Meet Not Creating
- Verify service account has Calendar API enabled
- Check that GOOGLE_PRIVATE_KEY has proper line breaks
- Ensure calendar is shared with service account

### Recording Not Working
- Verify Recall.ai API key is correct
- Check webhook URL is accessible
- Ensure ENABLE_RECORDING=true

### Voice Not Working
- Check ElevenLabs API key
- Verify ENABLE_VOICE=true
- Try different voice IDs

### Admin Can't Login
- Verify ADMIN_EMAIL and ADMIN_PASSWORD are set
- Check JWT_SECRET is configured
- Clear browser cookies and retry

## Security Notes

1. **Always use HTTPS** - Replit provides this automatically
2. **Keep secrets secure** - Never commit .env files
3. **Rotate keys regularly** - Update JWT_SECRET monthly
4. **Monitor usage** - Check API usage dashboards
5. **Enable 2FA** - On all service accounts

## Customization

### Adding Role Templates
1. Login to admin dashboard
2. Go to "Role Templates"
3. Click "Add New Role"
4. Define questions and traits
5. Save template

### Modifying Welcome Page
1. Login to admin dashboard
2. Go to "Settings"
3. Edit markdown content
4. Save changes

### Styling Changes
Edit CSS in HTML files:
- `/src/ui/landing.html` - Candidate welcome page
- `/src/ui/admin.html` - Admin dashboard
- `/src/ui/interview.html` - Interview interface

## Support

For issues:
1. Check Replit logs (Console tab)
2. Verify all API keys are correct
3. Test with DEBUG=true
4. Review error messages

## Cost Considerations

- **Claude API**: ~$0.01-0.02 per interview
- **ElevenLabs**: ~$0.13 per 1000 characters
- **Recall.ai**: Check current pricing
- **Google APIs**: Usually free tier sufficient
- **Replit**: Free tier works, paid for always-on

## Next Steps

1. Test with mock interview
2. Customize role templates
3. Brand the interface
4. Set up monitoring
5. Train HR team