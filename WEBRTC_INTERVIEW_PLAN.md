# WebRTC-Based AI Interview Platform

## Overview
Replace Google Meet with a built-in WebRTC video interview system that integrates directly with Claude AI and ElevenLabs.

## Architecture

### 1. Frontend Components
- **Interview Room** (`/interview/:sessionId`)
  - Video/audio display for candidate
  - AI avatar or waveform visualization
  - Chat transcript panel
  - Interview progress indicator

### 2. WebRTC Implementation
```javascript
// Peer connection for candidate
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Capture candidate audio/video
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
```

### 3. Interview Flow
1. Candidate joins interview room
2. WebRTC connection established
3. AI interviewer introduces itself (ElevenLabs voice)
4. Questions asked one by one
5. Candidate responses captured via Web Audio API
6. Responses transcribed and sent to Claude
7. Claude generates follow-up or next question
8. Process repeats until interview complete

### 4. Key Features
- **No External Dependencies**: Everything runs in-browser
- **Real-time Interaction**: Instant AI responses
- **Natural Conversation**: ElevenLabs voice makes it feel human
- **Smart Follow-ups**: Claude analyzes responses dynamically
- **Built-in Recording**: MediaRecorder API for session recording
- **Transcript Generation**: Real-time speech-to-text

### 5. Technical Stack
- **WebRTC**: For video/audio streaming
- **Socket.io**: For signaling and real-time events
- **Web Audio API**: For audio processing
- **MediaRecorder API**: For recording interviews
- **Web Speech API**: For speech recognition (or Whisper API)
- **Claude API**: For intelligent responses
- **ElevenLabs API**: For AI voice

### 6. Implementation Phases

#### Phase 1: Basic Video Room
- WebRTC connection between candidate and server
- Basic UI with video/audio controls
- Simple signaling server

#### Phase 2: AI Integration
- Claude AI for question generation
- ElevenLabs for voice synthesis
- Basic interview flow

#### Phase 3: Advanced Features
- Real-time transcription
- Recording and playback
- Advanced interview analytics
- Multiple question types

## Benefits Over Google Meet
1. **Full Control**: No external service limitations
2. **Deeper Integration**: Direct access to audio streams
3. **Cost Effective**: No Google Cloud costs
4. **Customizable**: Complete control over UI/UX
5. **Replit Optimized**: Designed for Replit constraints