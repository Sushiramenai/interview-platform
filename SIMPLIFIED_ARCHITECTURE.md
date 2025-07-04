# Simplified AI Interview Platform Architecture

## Core Purpose
A simple, self-contained AI interview platform that:
- Hosts video interviews directly (no external platforms)
- Uses Claude AI to conduct intelligent interviews
- Speaks with natural voice via ElevenLabs
- Records everything for HR review
- Automatically scores candidates

## Simplified Flow

```
1. HR Creates Interview Link
   ↓
2. Candidate Joins Interview
   ↓
3. AI Conducts Interview (Video + Voice)
   ↓
4. System Records & Transcribes
   ↓
5. AI Scores Candidate
   ↓
6. HR Reviews Results
```

## Components to Keep

1. **Frontend**
   - `/hr` - Simple HR dashboard
   - `/interview/:id` - Interview room
   - `/results` - View results

2. **Backend**
   - WebRTC server for video
   - Claude AI for intelligence
   - ElevenLabs for voice
   - Recording system
   - Simple scoring

3. **Required Services**
   - Claude API (questions & evaluation)
   - ElevenLabs API (voice)
   - That's it!

## Components to Remove

- ❌ All Google Meet code
- ❌ Google Calendar integration
- ❌ Google Drive upload
- ❌ Puppeteer bots
- ❌ Complex orchestrators
- ❌ Manual interview mode
- ❌ Recall.ai integration
- ❌ Complex authentication
- ❌ Multiple interview modes

## Simplified File Structure

```
/
├── server.js              # Simple Express server
├── package.json          # Minimal dependencies
├── .env                  # Just 2 API keys
├── /public
│   ├── /js
│   │   └── interview.js  # Interview room logic
│   └── /css
│       └── styles.css    # Simple styles
├── /views
│   ├── hr-dashboard.html # HR interface
│   ├── interview.html    # Interview room
│   └── results.html      # Results viewer
├── /src
│   ├── ai-interviewer.js # Claude integration
│   ├── voice.js          # ElevenLabs integration
│   ├── recorder.js       # Recording logic
│   └── evaluator.js      # Scoring system
└── /data
    ├── /recordings       # Interview recordings
    └── /results         # Interview results
```

## For Non-Tech HR Users

1. **Setup**: Run one command, enter 2 API keys
2. **Create Interview**: Click button, get link
3. **Share Link**: Send to candidate
4. **View Results**: See recordings, transcripts, scores

## Key Improvements

1. **Single Purpose**: Only does AI interviews
2. **No External Deps**: Everything built-in
3. **Simple Setup**: 2 API keys, that's it
4. **HR Friendly**: No technical knowledge needed
5. **Automatic**: Recording, transcription, scoring all automatic