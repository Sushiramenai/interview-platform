# 🚀 Easy Deployment Guide for HR Teams

## The Simplest Way: Replit (Recommended)

### Why Replit?
- ✅ No technical knowledge needed
- ✅ Works in your web browser
- ✅ One-click deployment
- ✅ Always online (no computer needed)
- ✅ HR team gets a simple URL to access

## Step-by-Step Replit Setup

### 1. **Create Replit Account**
- Go to: https://replit.com/signup
- Sign up with Google or email
- Choose the free plan (or Hacker plan for $7/month for better performance)

### 2. **Import from GitHub**
- Click "+ Create Repl"
- Click "Import from GitHub"
- Paste: `https://github.com/Sushiramenai/interview-platform`
- Click "Import from GitHub"

### 3. **Configure Secrets (API Keys)**
In Replit:
- Click the 🔒 "Secrets" tab (left sidebar)
- Add these secrets:

```
SESSION_SECRET = your-secret-key-here
```

That's it! The other API keys will be added through the web interface.

### 4. **Start the Platform**
- Click the big green "Run" button
- Wait for it to install (2-3 minutes first time)
- You'll see: "Interview platform running on..."

### 5. **Access Your Platform**
- Your URL will be: `https://interview-platform-[username].repl.co`
- Bookmark this URL!

## For Your HR Team

### What They Need to Know:

#### **Admin Access**
- URL: `https://interview-platform-[username].repl.co/login`
- Username: `Admin`
- Password: `admin123`

#### **First Time Setup** (One-time only)
1. Login to admin panel
2. Go to "API Configuration"
3. Add the 3 API keys:
   - Claude AI key
   - Google Service Account JSON
   - ElevenLabs key
4. Click "Save All API Keys"

#### **Daily Use**
1. **Create Interview Roles**:
   - Go to "Role Templates"
   - Click "Add New Role"
   - Add questions
   - Save

2. **Share with Candidates**:
   - Copy the interview link from Role Templates
   - Send to candidates via email

3. **View Results**:
   - Go to "Candidate Results"
   - See scores and evaluations

## Alternative Options

### Option 2: **Cloud VPS** (More Control)
- DigitalOcean Droplet ($6/month)
- Heroku ($7/month)
- AWS EC2 (Free tier available)

### Option 3: **Local Server** (Free but Complex)
- Dedicated computer in office
- Always on
- Requires IT setup

## Important Notes for Replit

### Limitations:
- **Free Plan**: App sleeps after inactivity
- **Self-hosted Bot**: May not work on free tier (needs Chrome)
- **Solution**: Use manual interview mode or upgrade to Hacker plan

### For AI Bot to Work on Replit:
You need the **Hacker Plan** ($7/month) because:
- AI bot needs Chrome browser
- Requires more RAM
- Needs persistent storage

### If Using Free Plan:
- System works in "Manual Mode"
- HR gets interview guides
- Human conducts interview
- Still tracks everything!

## Quick Troubleshooting

### "Cannot login"
- Check caps lock
- Username: Admin (capital A)
- Password: admin123

### "API Configuration shows errors"
- Double-check API keys
- Make sure to paste entire JSON for Google
- Test each key individually

### "Bot doesn't join Meet"
- Replit free tier limitation
- Upgrade to Hacker plan OR
- Use manual interview mode

## For IT Support

If HR needs help, they can:
1. Check system status in "API Configuration"
2. All services should show ✅
3. If issues, verify API keys
4. Contact IT with error messages

## Summary for HR

**Your Interview Platform URL**: `https://interview-platform-[username].repl.co`

**What HR Can Do**:
- ✅ Create role templates
- ✅ Share interview links
- ✅ View results
- ✅ No technical skills needed!

**What Happens**:
1. Candidate clicks link
2. Enters their info
3. Joins Google Meet
4. AI bot interviews them (or human with guide)
5. Results appear in dashboard

**Monthly Cost**:
- Replit Free: $0 (manual interviews)
- Replit Hacker: $7 (AI bot interviews)
- API costs: ~$0.11 per interview

That's it! Your HR team just needs the URL and login credentials. Everything else is point-and-click! 🎉