require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (could be replaced with database)
const interviews = new Map();
const results = new Map();

// ===== SIMPLIFIED SERVICES =====

// AI Interviewer Service
class AIInterviewer {
    constructor() {
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        this.questions = [
            "Tell me about yourself and your professional background.",
            "What interests you most about this role?",
            "Describe a challenging project you've worked on recently.",
            "How do you handle feedback and criticism?",
            "Where do you see yourself professionally in 5 years?",
            "Do you have any questions for me about the role or company?"
        ];
    }
    
    async getNextQuestion(index) {
        if (index < this.questions.length) {
            return this.questions[index];
        }
        return null;
    }
    
    async evaluateCandidate(transcript, role) {
        if (!this.claudeApiKey) {
            return { score: 0, summary: "API key not configured" };
        }
        
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: this.claudeApiKey });
            
            const prompt = `Based on this interview transcript for a ${role} position, provide:
1. A score from 1-10
2. A 2-3 sentence summary
3. Key strengths (2-3 points)
4. Areas for improvement (2-3 points)

Transcript:
${transcript}

Respond in JSON format: { "score": 8, "summary": "...", "strengths": ["..."], "improvements": ["..."] }`;
            
            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }]
            });
            
            return JSON.parse(response.content[0].text);
        } catch (error) {
            console.error('Evaluation error:', error);
            return { 
                score: 0, 
                summary: "Evaluation failed", 
                strengths: [], 
                improvements: [] 
            };
        }
    }
}

// Voice Service
class VoiceService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    }
    
    async generateSpeech(text) {
        if (!this.apiKey) {
            console.log('ElevenLabs not configured, skipping voice');
            return null;
        }
        
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_monolingual_v1',
                        voice_settings: {
                            stability: 0.75,
                            similarity_boost: 0.75
                        }
                    })
                }
            );
            
            if (!response.ok) {
                throw new Error('Voice generation failed');
            }
            
            const audioBuffer = await response.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');
            return `data:audio/mpeg;base64,${audioBase64}`;
        } catch (error) {
            console.error('Voice generation error:', error);
            return null;
        }
    }
}

// Initialize services
const aiInterviewer = new AIInterviewer();
const voiceService = new VoiceService();

// ===== ROUTES =====

// HR Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/hr-dashboard.html'));
});

// Create new interview
app.post('/api/interviews/create', async (req, res) => {
    const { candidateName, candidateEmail, role } = req.body;
    const interviewId = uuidv4();
    
    const interview = {
        id: interviewId,
        candidateName,
        candidateEmail,
        role,
        status: 'pending',
        createdAt: new Date().toISOString(),
        interviewUrl: `/interview/${interviewId}`
    };
    
    interviews.set(interviewId, interview);
    
    res.json({
        success: true,
        interviewId,
        interviewUrl: `${req.protocol}://${req.get('host')}/interview/${interviewId}`
    });
});

// Get all interviews
app.get('/api/interviews', (req, res) => {
    const allInterviews = Array.from(interviews.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(allInterviews);
});

// Get interview results
app.get('/api/results/:id', (req, res) => {
    const result = results.get(req.params.id);
    if (result) {
        res.json(result);
    } else {
        res.status(404).json({ error: 'Results not found' });
    }
});

// Interview room
app.get('/interview/:id', (req, res) => {
    const interview = interviews.get(req.params.id);
    if (interview) {
        res.sendFile(path.join(__dirname, 'views/interview.html'));
    } else {
        res.status(404).send('Interview not found');
    }
});

// Results viewer
app.get('/results/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/results.html'));
});

// ===== SOCKET.IO HANDLERS =====

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-interview', async (data) => {
        const { interviewId } = data;
        const interview = interviews.get(interviewId);
        
        if (!interview) {
            socket.emit('error', { message: 'Interview not found' });
            return;
        }
        
        socket.join(interviewId);
        interview.status = 'active';
        interview.startedAt = new Date().toISOString();
        
        // Start interview with greeting
        const greeting = `Hello ${interview.candidateName}! I'm your AI interviewer today. 
        I'll be asking you some questions about your background and experience for the ${interview.role} position. 
        Please speak clearly and take your time with each answer. Let's begin!`;
        
        const greetingAudio = await voiceService.generateSpeech(greeting);
        
        socket.emit('interview-started', {
            interview,
            greeting,
            greetingAudio,
            totalQuestions: aiInterviewer.questions.length
        });
        
        // Store session data
        socket.interviewId = interviewId;
        socket.questionIndex = -1;
        socket.transcript = [{
            speaker: 'AI',
            text: greeting,
            timestamp: new Date().toISOString()
        }];
        socket.responses = [];
    });
    
    socket.on('ready-for-question', async () => {
        if (!socket.interviewId) return;
        
        socket.questionIndex++;
        const question = await aiInterviewer.getNextQuestion(socket.questionIndex);
        
        if (question) {
            const audio = await voiceService.generateSpeech(question);
            
            socket.emit('ai-question', {
                questionIndex: socket.questionIndex,
                question,
                audio
            });
            
            socket.transcript.push({
                speaker: 'AI',
                text: question,
                timestamp: new Date().toISOString()
            });
        } else {
            // Interview complete
            await completeInterview(socket);
        }
    });
    
    socket.on('candidate-response', async (data) => {
        const { text } = data;
        
        socket.transcript.push({
            speaker: 'Candidate',
            text,
            timestamp: new Date().toISOString()
        });
        
        socket.responses.push({
            questionIndex: socket.questionIndex,
            question: aiInterviewer.questions[socket.questionIndex],
            response: text,
            timestamp: new Date().toISOString()
        });
        
        // Simple acknowledgment
        const ack = "Thank you for that answer. Let me ask you the next question.";
        const ackAudio = await voiceService.generateSpeech(ack);
        
        socket.emit('ai-acknowledgment', {
            text: ack,
            audio: ackAudio
        });
    });
    
    socket.on('save-recording', async (data) => {
        if (!socket.interviewId) return;
        
        try {
            // Save recording blob
            const recordingPath = path.join(__dirname, 'data/recordings', `${socket.interviewId}.webm`);
            await fs.mkdir(path.dirname(recordingPath), { recursive: true });
            
            const buffer = Buffer.from(data.recording.split(',')[1], 'base64');
            await fs.writeFile(recordingPath, buffer);
            
            console.log('Recording saved for interview:', socket.interviewId);
        } catch (error) {
            console.error('Error saving recording:', error);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.interviewId) {
            const interview = interviews.get(socket.interviewId);
            if (interview && interview.status === 'active') {
                completeInterview(socket);
            }
        }
    });
});

async function completeInterview(socket) {
    const interview = interviews.get(socket.interviewId);
    if (!interview) return;
    
    interview.status = 'completed';
    interview.completedAt = new Date().toISOString();
    
    // Create transcript text
    const transcriptText = socket.transcript
        .map(entry => `${entry.speaker}: ${entry.text}`)
        .join('\n\n');
    
    // Get AI evaluation
    const evaluation = await aiInterviewer.evaluateCandidate(transcriptText, interview.role);
    
    // Calculate duration
    const duration = new Date(interview.completedAt) - new Date(interview.startedAt);
    const durationMinutes = Math.floor(duration / 60000);
    
    // Save results
    const result = {
        id: interview.id,
        interview,
        transcript: socket.transcript,
        responses: socket.responses,
        evaluation,
        duration: `${durationMinutes} minutes`,
        recordingUrl: `/data/recordings/${interview.id}.webm`
    };
    
    results.set(interview.id, result);
    
    // Save to file for persistence
    const resultsPath = path.join(__dirname, 'data/results', `${interview.id}.json`);
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
    
    // Notify client
    const closing = `Thank you so much for your time today, ${interview.candidateName}. 
    We've completed all the questions. Your responses have been recorded and will be reviewed by our team. 
    We'll be in touch soon with next steps. Have a great day!`;
    
    const closingAudio = await voiceService.generateSpeech(closing);
    
    socket.emit('interview-completed', {
        message: closing,
        audio: closingAudio,
        evaluation
    });
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AI Interview Platform running on http://localhost:${PORT}`);
    console.log('\n📋 Required API Keys:');
    console.log(`   Claude API: ${process.env.CLAUDE_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log('\n🔗 Endpoints:');
    console.log(`   HR Dashboard: http://localhost:${PORT}`);
    console.log(`   Create Interview: POST /api/interviews/create`);
    console.log(`   Interview Room: /interview/:id`);
    console.log(`   View Results: /results/:id\n`);
});