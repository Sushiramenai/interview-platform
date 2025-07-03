# Video Interview System Flow

## How It Works

### 1. HR Admin Setup
- Login to admin panel: http://localhost:3000/login (Username: Admin, Password: admin123)
- Configure API keys in "API Configuration" section:
  - **Claude API Key** (Required): Powers the AI interviewer
  - **Google Service Account JSON** (Required): Creates Meet rooms
  - **ElevenLabs API Key** (Optional but recommended): AI voice synthesis
  - **Recall.ai API Key** (Required): Records the video interview
- Create role templates with custom questions

### 2. Candidate Interview Flow
- Candidate receives link: `http://localhost:3000/candidate?role=software_engineer`
- Clicks "Start Interview" and enters name/email
- System checks if they've already attempted (one-shot only)
- Creates Google Meet room
- Opens Meet in new tab/window
- AI interviewer bot joins the Meet
- Bot asks questions verbally using voice synthesis
- Entire session is video recorded
- No cancel/redo option once started

### 3. What Happens in Google Meet
- Candidate joins the Meet room
- AI bot "Claude - AI Interviewer" joins automatically
- Bot introduces itself and starts asking questions
- Bot waits for responses and provides transitions
- After all questions, bot thanks candidate and leaves
- Recording is saved automatically

### 4. Results
- Interview is automatically evaluated
- Results appear in admin dashboard
- Video recording is available for review
- Scores and transcripts are saved

## Current Implementation Status

✅ Fixed: Admin role management buttons
✅ Fixed: Redirects to Google Meet (not text-based)
✅ Implemented: One-shot interview lock
✅ Implemented: Video interview orchestrator
✅ Implemented: Meet bot controller
✅ Implemented: Voice synthesis integration

## Required API Keys

1. **Claude API Key**: Get from https://console.anthropic.com/
2. **Google Service Account**: 
   - Create project in Google Cloud Console
   - Enable Calendar API
   - Create service account with Calendar access
   - Download JSON credentials
3. **ElevenLabs API Key**: Get from https://elevenlabs.io/
4. **Recall.ai API Key**: Get from https://recall.ai/

## Testing the System

1. Start the server: `npm start`
2. Login as admin and configure API keys
3. Create a test role (e.g., "Software Engineer")
4. Visit candidate link in incognito/private window
5. Enter test details and start interview
6. System will open Google Meet with AI interviewer

## Troubleshooting

- If Google Meet doesn't open: Check popup blocker
- If bot doesn't join: Verify Recall.ai API key
- If no voice: Check ElevenLabs API key
- If evaluation fails: Verify Claude API key