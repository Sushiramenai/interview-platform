// Load environment variables
try {
    require('dotenv').config();
} catch (e) {
    console.log('Note: dotenv not loaded, using environment variables');
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const ProfessionalInterviewOrchestrator = require('./interview-orchestrator-v2');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8 // 100 MB - allows for large recordings
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/data/recordings', express.static(path.join(__dirname, 'data/recordings'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webm')) {
            res.set('Content-Type', 'video/webm');
            res.set('Accept-Ranges', 'bytes');
        }
    }
}));
app.use(express.static('public'));

// In-memory storage (could be replaced with database)
const interviews = new Map();
const results = new Map();
const templates = new Map();

// Configuration storage
let appConfig = {
    openai_api_key: process.env.OPENAI_API_KEY || '',
    elevenlabs_api_key: process.env.ELEVENLABS_API_KEY || '',
    elevenlabs_voice_id: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    
    // Recording Settings
    recording_settings: {
        maxFileSizeMB: 600, // Max 600 MB per recording (enough for 30 min)
        maxStorageGB: 20, // Total storage limit
        autoCleanupDays: 30, // Auto-delete after 30 days
        compressionEnabled: false // Can enable if needed
    }
};

// Load config from file if exists
async function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        appConfig = { ...appConfig, ...JSON.parse(configData) };
    } catch (error) {
        // Config file doesn't exist, use defaults
    }
}

// Save config to file
async function saveConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(appConfig, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Initialize config and ensure data directories exist on startup
loadConfig();

// Ensure data directories exist
async function ensureDataDirectories() {
    const dirs = [
        path.join(__dirname, 'data'),
        path.join(__dirname, 'data/recordings'),
        path.join(__dirname, 'data/results'),
        path.join(__dirname, 'data/templates')
    ];
    
    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true }).catch(() => {});
    }
}

ensureDataDirectories();

// ===== SIMPLIFIED SERVICES =====

// Initialize Professional Interview Orchestrator
let aiOrchestrator = null;

function getAIOrchestrator() {
    if (!aiOrchestrator && appConfig.openai_api_key) {
        try {
            const openai = new OpenAI({ apiKey: appConfig.openai_api_key });
            aiOrchestrator = new ProfessionalInterviewOrchestrator(openai);
        } catch (error) {
            console.error('Error initializing Interview Orchestrator:', error);
        }
    }
    return aiOrchestrator;
}

// Legacy AI Interviewer Service (kept for compatibility)
class AIInterviewer {
    constructor() {
        this.conversationHistory = new Map();
        // Default questions - can be customized per interview
        this.defaultQuestions = [
            "Tell me about yourself and your professional background.",
            "What interests you most about this role?",
            "Describe a challenging project you've worked on recently.",
            "How do you handle feedback and criticism?",
            "Where do you see yourself professionally in 5 years?",
            "Do you have any questions for me about the role or company?"
        ];
    }
    
    getOpenAIClient() {
        if (!appConfig.openai_api_key) {
            console.warn('OpenAI API key not configured');
            return null;
        }
        try {
            return new OpenAI({ apiKey: appConfig.openai_api_key });
        } catch (error) {
            console.error('Error initializing OpenAI client:', error);
            return null;
        }
    }
    
    getQuestionsForRole(role, customQuestions) {
        // Use custom questions if provided, otherwise use defaults
        let questions = customQuestions && customQuestions.length > 0 ? customQuestions : this.defaultQuestions;
        
        // Clean all questions to ensure they're single questions
        questions = questions.map(q => this.cleanQuestion(q));
        
        console.log('Prepared questions for interview:', questions);
        return questions;
    }
    
    // Helper to clean and split compound questions
    cleanQuestion(question) {
        // Remove multiple question marks and split compound questions
        // Example: "Tell me about X? How did you Y? What was Z?" → "Tell me about X"
        
        // First, check if this is a compound question with multiple sentences ending in ?
        const questionParts = question.split('?').filter(part => part.trim());
        
        if (questionParts.length > 1) {
            // Take only the first question
            let mainQuestion = questionParts[0].trim() + '?';
            console.log('Split compound question:', question, '→', mainQuestion);
            return mainQuestion;
        }
        
        // Also check for questions separated by periods
        const sentences = question.split(/[.!]+/).filter(s => s.trim());
        if (sentences.length > 1 && sentences[0].length > 20) {
            let mainQuestion = sentences[0].trim();
            if (!mainQuestion.endsWith('?')) {
                mainQuestion += '?';
            }
            console.log('Split multi-sentence question:', question, '→', mainQuestion);
            return mainQuestion;
        }
        
        return question.trim();
    }
    
    // Filter out any meta-instructions that might leak into responses
    filterMetaInstructions(text) {
        // Patterns that indicate meta-instructions
        const metaPatterns = [
            /make it feel like/gi,
            /keep it natural/gi,
            /be professional/gi,
            /maintain.*demeanor/gi,
            /1-3 sentences/gi,
            /brief acknowledgment/gi,
            /transition to/gi,
            /as an interviewer/gi,
            /your task is/gi,
            /remember to/gi,
            /make sure to/gi,
            /follow.*instruction/gi,
            /[\(\[].*instructions?.*[\)\]]/gi
        ];
        
        let filtered = text;
        metaPatterns.forEach(pattern => {
            if (pattern.test(filtered)) {
                console.log('Filtering meta-instruction:', filtered.match(pattern));
                filtered = filtered.replace(pattern, '');
            }
        });
        
        // Clean up any double spaces or weird punctuation left behind
        filtered = filtered.replace(/\s+/g, ' ').trim();
        filtered = filtered.replace(/\s+([.?!,])/g, '$1');
        filtered = filtered.replace(/^[,.]\s*/, '');
        
        return filtered;
    }
    
    async getNextQuestion(index, questions, interviewId, previousResponse, jobDescription = '') {
        const questionSet = questions || this.defaultQuestions;
        if (index < questionSet.length) {
            // Clean the question to ensure we only ask one thing at a time
            const rawQuestion = questionSet[index];
            const cleanedQuestion = this.cleanQuestion(rawQuestion);
            // Get conversation context
            const history = this.conversationHistory.get(interviewId) || [];
            
            // Generate a conversational bridge if we have OpenAI configured
            const openai = this.getOpenAIClient();
            if (openai && previousResponse && index > 0) {
                try {
                    const jobContext = jobDescription ? 
                        `\n\nJob Description Context:\n${jobDescription.substring(0, 500)}...` : '';
                    
                    // Optimal system prompt for professional, natural interviews
                    const systemPrompt = `You are conducting a professional interview. Maintain a formal yet approachable demeanor.

Your response should:
1. Briefly acknowledge what the candidate just said (1 sentence)
2. Then ask the next question

Do NOT include multiple questions or sub-questions.
Do NOT explain what you're doing.
Just acknowledge and ask the single question.`;
                    
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Candidate just said: "${previousResponse}"\n\nNext question: "${cleanedQuestion}"\n\nAcknowledge briefly, then ask the question.`
                            }
                        ],
                        max_tokens: 150,
                        temperature: 0.6 // Lower for more controlled output
                    });
                    
                    let generatedResponse = response.choices[0].message.content;
                    
                    // Post-process to remove any leaked instructions
                    generatedResponse = this.filterMetaInstructions(generatedResponse);
                    
                    // Ensure the cleaned question is included if it got lost
                    if (!generatedResponse.includes(cleanedQuestion.replace('?', ''))) {
                        console.warn('Question missing from response, appending it');
                        generatedResponse += ' ' + cleanedQuestion;
                    }
                    
                    return generatedResponse;
                } catch (error) {
                    console.error('Error generating conversational response:', error);
                }
            }
            
            // For the first question or if AI generation fails
            return cleanedQuestion;
        }
        return null;
    }
    
    async analyzeResponse(question, response) {
        const openai = this.getOpenAIClient();
        if (!openai) return { type: 'normal', needsAction: false };
        
        try {
            const systemPrompt = `You are analyzing a candidate's response during an interview to understand their intent and needs.
            
            Analyze the response and determine:
            1. Is the candidate asking to repeat the question?
            2. Is the candidate asking for clarification?
            3. Is the candidate saying they don't understand?
            4. Is the candidate asking to skip or move on?
            5. Is the candidate finished with their answer and ready for next question?
            6. Is this a normal answer that might continue?
            
            Common patterns to look for:
            - "Can you repeat that?" / "What was the question?" / "Sorry, I didn't catch that" → repeat
            - "Can you clarify?" / "What do you mean by..." / "I'm not sure I understand" → clarify
            - "I don't know" / "I'm not familiar with..." / "I haven't had that experience" → unsure
            - "Can we skip this?" / "Next question" / "Pass" → skip
            - "That's all" / "I'm done" / "That's my answer" / "I'm finished" → finished
            - Normal substantive answer → normal
            
            Respond with JSON: { "type": "repeat|clarify|unsure|skip|finished|normal", "confidence": 0.0-1.0 }`;
            
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Question: ${question}\n\nCandidate's response: ${response}` }
                ],
                response_format: { type: "json_object" },
                max_tokens: 50,
                temperature: 0.3
            });
            
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error analyzing response:', error);
            return { type: 'normal', confidence: 0.5 };
        }
    }
    
    async generateContextualResponse(type, question, response, interviewId) {
        const openai = this.getOpenAIClient();
        if (!openai) return null;
        
        try {
            let systemPrompt = '';
            let userPrompt = '';
            
            switch (type) {
                case 'repeat':
                    systemPrompt = `You are a friendly interviewer. The candidate has asked you to repeat the question. 
                    Acknowledge their request politely and repeat the question clearly. Keep it natural and conversational.`;
                    userPrompt = `Original question: ${question}\n\nRepeat this question in a natural, clear way with a brief acknowledgment.`;
                    break;
                    
                case 'clarify':
                    systemPrompt = `You are a helpful interviewer. The candidate needs clarification on the question. 
                    Acknowledge their request and rephrase the question more clearly, perhaps with an example.`;
                    userPrompt = `Original question: ${question}\n\nCandidate asked: ${response}\n\nProvide a clearer version of the question.`;
                    break;
                    
                case 'unsure':
                    // Professional interviews don't offer to skip - they wait patiently
                    systemPrompt = `You are a professional interviewer. The candidate seems unsure about the question. 
                    Simply rephrase the question more clearly. Do NOT offer to skip or comment on difficulty.`;
                    userPrompt = `Original question: ${question}\n\nCandidate indicated uncertainty: ${response}\n\nRephrase the question clearly and wait for their answer.`;
                    break;
                    
                case 'skip':
                    // In professional interviews, we don't skip questions
                    systemPrompt = `You are a professional interviewer. The candidate wants to skip the question. 
                    Politely redirect them back to the question. This is an interview and all questions need to be addressed.`;
                    userPrompt = `The candidate wants to skip. Professionally explain that you'd like to hear their thoughts on this question, even if brief.`;
                    break;
                    
                default:
                    return null;
            }
            
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 150,
                temperature: 0.7
            });
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating contextual response:', error);
            return null;
        }
    }
    
    async generateFollowUp(interviewId, question, response, followUpCount = 0) {
        const openai = this.getOpenAIClient();
        if (!openai) return null;
        
        // Optimal follow-up behavior: max 2 follow-ups per question
        const maxFollowUps = 2;
        const followUpFrequency = 0.3; // 30% chance
        
        // Check if we should ask a follow-up
        if (followUpCount >= maxFollowUps) {
            return null;
        }
        
        // Don't follow up on very short responses (likely "I don't know" or similar)
        if (response.length < 30) {
            return null;
        }
        
        // Adjust probability based on response completeness
        let shouldFollowUp = Math.random() < followUpFrequency;
        
        // Check if the response seems incomplete or vague
        const vagueIndicators = [
            'maybe', 'i guess', 'sort of', 'kind of', 'probably',
            'i think', 'not sure', 'hard to say'
        ];
        
        const hasVagueLanguage = vagueIndicators.some(indicator => 
            response.toLowerCase().includes(indicator)
        );
        
        // Check if response lacks specifics
        const hasSpecifics = /\\d+|%|\\$|specific|example|instance/i.test(response);
        
        // Always follow up on vague answers
        if (hasVagueLanguage && !hasSpecifics) {
            shouldFollowUp = true;
        }
        
        if (!shouldFollowUp) {
            return null;
        }
        
        try {
            // Much simpler prompt to generate natural follow-ups
            const systemPrompt = `You are conducting an interview. The candidate just answered a question.
            
Based on their specific answer, ask ONE natural follow-up question that:
- Relates directly to what they just said
- Asks for a specific example OR clarification
- Is brief and conversational

If their answer is already detailed and complete, respond with exactly: "NO_FOLLOWUP"

Do NOT ask multiple questions.
Do NOT include any instructions or explanations.`;
            
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `Original question: "${question}"
                        
Their answer: "${response}"

Generate ONE follow-up question or NO_FOLLOWUP.`
                    }
                ],
                max_tokens: 80,
                temperature: 0.7
            });
            
            let followUp = completion.choices[0].message.content.trim();
            
            // Filter any meta-instructions
            followUp = this.filterMetaInstructions(followUp);
            
            // Check if it's a no-followup response
            if (followUp.toLowerCase().includes('no_followup') || followUp.length < 10) {
                return null;
            }
            
            // Ensure it's actually a question
            if (!followUp.includes('?')) {
                followUp += '?';
            }
            
            console.log('Generated follow-up:', followUp);
            return followUp;
        } catch (error) {
            console.error('Error generating follow-up:', error);
            return null;
        }
    }
    
    async evaluateCandidate(transcript, role, jobDescription = '') {
        const openai = this.getOpenAIClient();
        if (!openai) {
            return { score: 0, summary: "API key not configured" };
        }
        
        try {
            const jobContext = jobDescription ? 
                `\n\nJob Description:\n${jobDescription}\n` : '';
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo', // Advanced model for complex evaluation and scoring
                messages: [
                    {
                        role: 'system',
                        content: `You are evaluating a candidate for a ${role} position. Provide a thorough, 
                        fair evaluation. Be constructive and professional. Score fairly - 7-8 is excellent, 
                        9-10 is exceptional.${jobContext}`
                    },
                    {
                        role: 'user',
                        content: `Based on this interview transcript, provide a comprehensive evaluation:

1. Overall Score (1-10) - Be fair but discerning
2. Executive Summary (3-4 sentences) - Overall impression and fit for the role
3. Strengths (3-5 specific points) - What they did well with examples from their answers
4. Weaknesses (2-4 specific points) - Areas where they struggled or could improve
5. Red Flags (if any) - Concerning behaviors, inconsistencies, or major gaps
6. Recommendations - Clear hiring recommendation with reasoning
7. Follow-up Areas - Topics to explore in next rounds if moving forward

Evaluation Criteria:
- Technical competence for the ${role} position
- Communication skills and articulation
- Problem-solving approach and thought process
- Relevant experience and achievements
- Cultural fit and soft skills
- Enthusiasm and motivation for the role
${jobDescription ? '- Specific alignment with job requirements' : ''}

Transcript:
${transcript}

Respond in JSON format:
{
  "score": 7.5,
  "summary": "Strong candidate with...",
  "strengths": [
    "Technical expertise: Demonstrated deep knowledge of...",
    "Communication: Clear and structured responses..."
  ],
  "weaknesses": [
    "Limited experience with...",
    "Could improve on..."
  ],
  "redFlags": ["Any concerning issues"] or [],
  "recommendation": {
    "decision": "strong_yes|yes|maybe|no",
    "reasoning": "..."
  },
  "followUpAreas": ["Topics to explore further..."]
}`
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1000,
                temperature: 0.7
            });
            
            return JSON.parse(response.choices[0].message.content);
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
    
    updateConversationHistory(interviewId, speaker, text) {
        const history = this.conversationHistory.get(interviewId) || [];
        history.push({ speaker, text, timestamp: new Date().toISOString() });
        this.conversationHistory.set(interviewId, history);
    }
}

// Voice Service
class VoiceService {
    constructor() {
        this.voiceSettings = {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
        };
    }
    
    get apiKey() {
        return appConfig.elevenlabs_api_key;
    }
    
    get voiceId() {
        return this._voiceId || appConfig.elevenlabs_voice_id;
    }
    
    set voiceId(id) {
        this._voiceId = id;
    }
    
    async generateSpeech(text) {
        if (!this.apiKey) {
            console.log('ElevenLabs not configured, skipping voice');
            return null;
        }
        
        if (!this.voiceId) {
            console.error('No voice ID specified');
            return null;
        }
        
        console.log('Generating speech for:', text.substring(0, 50) + '...');
        
        return new Promise((resolve) => {
            const https = require('https');
            const postData = JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: this.voiceSettings
            });
            
            const options = {
                hostname: 'api.elevenlabs.io',
                path: `/v1/text-to-speech/${this.voiceId}`,
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = https.request(options, (res) => {
                const chunks = [];
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const audioBuffer = Buffer.concat(chunks);
                        const audioBase64 = audioBuffer.toString('base64');
                        console.log('Voice generated successfully, size:', audioBase64.length);
                        resolve(`data:audio/mpeg;base64,${audioBase64}`);
                    } else {
                        console.error('ElevenLabs API error:', res.statusCode);
                        resolve(null);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('Voice generation error:', error.message);
                resolve(null);
            });
            
            req.write(postData);
            req.end();
        });
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
    const { candidateName, candidateEmail, role, voiceId, customQuestions, jobDescription, templateData } = req.body;
    const interviewId = uuidv4();
    
    const interview = {
        id: interviewId,
        candidateName,
        candidateEmail,
        role,
        voiceId: voiceId || 'EXAVITQu4vr4xnSDxMaL',
        customQuestions: customQuestions || [],
        jobDescription: jobDescription || '',
        templateData: templateData || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        interviewUrl: `/interview/${interviewId}`,
        // Single-use link tracking
        linkUsed: false,
        linkAccessedAt: null,
        linkAccessedFrom: null,
        completedAt: null,
        duration: null
    };
    
    interviews.set(interviewId, interview);
    
    console.log('Interview created:', {
        id: interviewId,
        voiceId: interview.voiceId,
        hasQuestions: interview.customQuestions.length > 0,
        hasJobDescription: !!interview.jobDescription
    });
    
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

// Test voice endpoint
app.post('/api/test-voice', async (req, res) => {
    const { voiceId, text = "Hello! This is a test of the voice synthesis system." } = req.body;
    
    try {
        // Make sure we have API key
        if (!appConfig.elevenlabs_api_key) {
            return res.status(400).json({ error: 'ElevenLabs API key not configured' });
        }
        
        // Create temporary voice service with the test voice ID
        const tempVoiceService = new VoiceService();
        tempVoiceService.voiceId = voiceId;
        const audio = await tempVoiceService.generateSpeech(text);
        
        if (!audio) {
            throw new Error('Voice generation returned no audio');
        }
        
        res.json({ audio });
    } catch (error) {
        console.error('Error testing voice:', error);
        res.status(500).json({ error: 'Failed to generate voice: ' + error.message });
    }
});

// Test interview page
app.get('/test-interview/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-interview.html'));
});

// Interview room
app.get('/interview/:id', (req, res) => {
    const interview = interviews.get(req.params.id);
    
    if (!interview) {
        return res.status(404).send(`
            <html>
                <head><title>Interview Not Found</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Interview Not Found</h1>
                    <p>This interview link is invalid or has expired.</p>
                </body>
            </html>
        `);
    }
    
    // Check if link has already been used
    if (interview.linkUsed && interview.status !== 'pending') {
        return res.status(403).send(`
            <html>
                <head><title>Interview Already Taken</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Interview Already Completed</h1>
                    <p>This interview link has already been used.</p>
                    <p>Interview was accessed on: ${new Date(interview.linkAccessedAt).toLocaleString()}</p>
                    <p style="color: #666; margin-top: 30px;">Each interview link can only be used once.</p>
                </body>
            </html>
        `);
    }
    
    // Mark link as accessed but allow the interview to proceed
    if (!interview.linkUsed) {
        interview.linkUsed = true;
        interview.linkAccessedAt = new Date().toISOString();
        interview.linkAccessedFrom = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        interviews.set(req.params.id, interview);
    }
    
    res.sendFile(path.join(__dirname, 'views/interview.html'));
});

// Results viewer
app.get('/results/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/results.html'));
});

// ===== SETTINGS ENDPOINTS =====

// Save API keys and settings
app.post('/api/settings/save', async (req, res) => {
    const { openai_api_key, elevenlabs_api_key, elevenlabs_voice_id } = req.body;
    
    // Update config
    if (openai_api_key !== undefined) appConfig.openai_api_key = openai_api_key;
    if (elevenlabs_api_key !== undefined) appConfig.elevenlabs_api_key = elevenlabs_api_key;
    if (elevenlabs_voice_id !== undefined) appConfig.elevenlabs_voice_id = elevenlabs_voice_id;
    
    // Save to file
    await saveConfig();
    
    res.json({ 
        success: true,
        message: 'Settings saved successfully'
    });
});

// Guidelines endpoint removed - using optimal defaults

// Check if API keys are configured
app.get('/api/settings/check', (req, res) => {
    res.json({
        openai: !!appConfig.openai_api_key,
        elevenlabs: !!appConfig.elevenlabs_api_key,
        voice_id: appConfig.elevenlabs_voice_id
    });
});

// Get storage statistics
app.get('/api/storage/stats', async (req, res) => {
    try {
        const recordingsDir = path.join(__dirname, 'data/recordings');
        let totalSize = 0;
        let fileCount = 0;
        
        try {
            const files = await fs.readdir(recordingsDir);
            
            for (const file of files) {
                if (file.endsWith('.webm')) {
                    const filePath = path.join(recordingsDir, file);
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                    fileCount++;
                }
            }
        } catch (error) {
            // Directory doesn't exist yet
        }
        
        const totalSizeMB = totalSize / 1024 / 1024;
        const totalSizeGB = totalSizeMB / 1024;
        const maxStorageGB = appConfig.recording_settings.maxStorageGB;
        const usagePercent = (totalSizeGB / maxStorageGB) * 100;
        
        res.json({
            totalFiles: fileCount,
            totalSizeMB: totalSizeMB.toFixed(2),
            totalSizeGB: totalSizeGB.toFixed(2),
            maxStorageGB: maxStorageGB,
            usagePercent: usagePercent.toFixed(1),
            maxFileSizeMB: appConfig.recording_settings.maxFileSizeMB,
            autoCleanupDays: appConfig.recording_settings.autoCleanupDays
        });
    } catch (error) {
        console.error('Error getting storage stats:', error);
        res.status(500).json({ error: 'Failed to get storage statistics' });
    }
});

// Test API connections
app.post('/api/test-connection', async (req, res) => {
    const { service } = req.body;
    
    try {
        if (service === 'openai') {
            if (!appConfig.openai_api_key) {
                return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
            }
            
            const openai = aiInterviewer.getOpenAIClient();
            if (!openai) {
                return res.status(400).json({ success: false, error: 'Failed to initialize OpenAI client' });
            }
            
            // Test with a simple completion
            const response = await openai.chat.completions.create({
                model: 'gpt-4o', // Using fast model for connection test
                messages: [{ role: 'user', content: 'Say "connection successful" in 3 words.' }],
                max_tokens: 10
            });
            
            res.json({ 
                success: true, 
                message: 'OpenAI connection successful',
                response: response.choices[0].message.content 
            });
            
        } else if (service === 'elevenlabs') {
            if (!appConfig.elevenlabs_api_key) {
                return res.status(400).json({ success: false, error: 'ElevenLabs API key not configured' });
            }
            
            // Test ElevenLabs using https module since fetch might not be available
            const https = require('https');
            
            const options = {
                hostname: 'api.elevenlabs.io',
                path: '/v1/voices',
                method: 'GET',
                headers: {
                    'xi-api-key': appConfig.elevenlabs_api_key
                }
            };
            
            const testRequest = https.request(options, (testResponse) => {
                let data = '';
                
                testResponse.on('data', (chunk) => {
                    data += chunk;
                });
                
                testResponse.on('end', () => {
                    if (testResponse.statusCode === 200) {
                        try {
                            const parsed = JSON.parse(data);
                            res.json({ 
                                success: true, 
                                message: 'ElevenLabs connection successful',
                                voiceCount: parsed.voices ? parsed.voices.length : 0
                            });
                        } catch (e) {
                            res.json({ 
                                success: true, 
                                message: 'ElevenLabs connection successful'
                            });
                        }
                    } else {
                        res.status(500).json({ 
                            success: false, 
                            error: `ElevenLabs API returned status ${testResponse.statusCode}` 
                        });
                    }
                });
            });
            
            testRequest.on('error', (error) => {
                res.status(500).json({ 
                    success: false, 
                    error: `Failed to connect to ElevenLabs: ${error.message}` 
                });
            });
            
            testRequest.end();
            
        } else {
            res.status(400).json({ success: false, error: 'Invalid service specified' });
        }
    } catch (error) {
        console.error(`Error testing ${service} connection:`, error);
        res.status(500).json({ 
            success: false, 
            error: `Failed to connect to ${service}: ${error.message}` 
        });
    }
});

// ===== TEMPLATE ENDPOINTS =====

// Generate job description suggestions using AI
app.post('/api/generate-suggestions', async (req, res) => {
    const { position, department, experienceLevel } = req.body;
    
    try {
        const openai = aiInterviewer.getOpenAIClient();
        if (!openai) {
            return res.status(400).json({ error: 'OpenAI API key not configured' });
        }
        
        const prompt = `Generate a comprehensive job description for a ${position} position${department ? ` in the ${department} department` : ''}${experienceLevel ? ` requiring ${experienceLevel} experience` : ''}.

Include:
1. A compelling overview (2-3 sentences)
2. Key responsibilities (5-7 bullet points)
3. Required qualifications (4-6 bullet points)
4. Nice-to-have skills (3-4 bullet points)
5. What we offer (3-4 bullet points)

Format it professionally and make it engaging to attract top talent.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo', // Advanced model for comprehensive job description generation
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert HR professional creating compelling job descriptions. Write in a professional yet engaging tone.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });
        
        const jobDescription = response.choices[0].message.content;
        
        // Also generate suggested interview questions
        const questionsPrompt = `Based on this ${position} role${department ? ` in ${department}` : ''}${experienceLevel ? ` (${experienceLevel})` : ''}, suggest 6-8 excellent behavioral interview questions that will help assess the candidate's fit for the role. Focus on questions that reveal experience, problem-solving ability, and cultural fit.`;
        
        const questionsResponse = await openai.chat.completions.create({
            model: 'gpt-4-turbo', // Advanced model for thoughtful question generation
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert interviewer. Create insightful behavioral interview questions.'
                },
                {
                    role: 'user',
                    content: questionsPrompt
                }
            ],
            max_tokens: 400,
            temperature: 0.7
        });
        
        const suggestedQuestions = questionsResponse.choices[0].message.content
            .split('\n')
            .filter(line => line.trim() && /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim());
        
        res.json({
            success: true,
            jobDescription,
            suggestedQuestions
        });
        
    } catch (error) {
        console.error('Error generating suggestions:', error);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// Get all templates
app.get('/api/templates', async (req, res) => {
    try {
        const templatesPath = path.join(__dirname, 'data/templates.json');
        let templatesData = [];
        
        try {
            const data = await fs.readFile(templatesPath, 'utf8');
            templatesData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, return empty array
        }
        
        res.json(templatesData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load templates' });
    }
});

// Create new template
app.post('/api/templates', async (req, res) => {
    try {
        const { position, department, level, duration, jobDescription, questions } = req.body;
        const template = {
            id: uuidv4(),
            position,
            department,
            level,
            duration: duration || 30,
            jobDescription,
            questions,
            createdAt: new Date().toISOString()
        };
        
        // Load existing templates
        const templatesPath = path.join(__dirname, 'data/templates.json');
        let templates = [];
        
        try {
            await fs.mkdir(path.dirname(templatesPath), { recursive: true });
            const data = await fs.readFile(templatesPath, 'utf8');
            templates = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, will create new one
        }
        
        // Add new template
        templates.push(template);
        
        // Save to file
        await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));
        
        res.json({ success: true, template });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Update template
app.put('/api/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { position, department, level, duration, jobDescription, questions } = req.body;
        
        // Load templates
        const templatesPath = path.join(__dirname, 'data/templates.json');
        let templates = [];
        
        try {
            const data = await fs.readFile(templatesPath, 'utf8');
            templates = JSON.parse(data);
        } catch (error) {
            return res.status(404).json({ error: 'Templates not found' });
        }
        
        // Find and update template
        const index = templates.findIndex(t => t.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        templates[index] = {
            ...templates[index],
            position,
            department,
            level,
            duration: duration || 30,
            jobDescription,
            questions,
            updatedAt: new Date().toISOString()
        };
        
        // Save
        await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));
        
        res.json({ success: true, template: templates[index] });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Load templates
        const templatesPath = path.join(__dirname, 'data/templates.json');
        let templates = [];
        
        try {
            const data = await fs.readFile(templatesPath, 'utf8');
            templates = JSON.parse(data);
        } catch (error) {
            return res.status(404).json({ error: 'Templates not found' });
        }
        
        // Filter out the template
        templates = templates.filter(t => t.id !== id);
        
        // Save
        await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// ===== SOCKET.IO HANDLERS =====

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Set up keep-alive ping
    const keepAliveInterval = setInterval(() => {
        socket.emit('ping');
    }, 20000); // Send ping every 20 seconds
    
    socket.on('pong', () => {
        // Client is still alive
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
        clearInterval(keepAliveInterval);
        
        // Clean up any interview data if needed
        if (socket.interviewId) {
            const interview = interviews.get(socket.interviewId);
            if (interview && interview.status === 'active') {
                interview.status = 'interrupted';
                console.log('Interview interrupted for:', socket.interviewId);
            }
        }
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', socket.id, error);
    });
    
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
        
        // Configure voice for this interview
        if (interview.voiceId) {
            voiceService.voiceId = interview.voiceId;
        }
        
        console.log('Interview session started:', {
            interviewId,
            voiceId: voiceService.voiceId,
            hasElevenLabsKey: !!appConfig.elevenlabs_api_key
        });
        
        // Initialize AI Orchestrator for this interview
        const orchestrator = getAIOrchestrator();
        console.log('AI Orchestrator status:', {
            exists: !!orchestrator,
            hasOpenAI: !!appConfig.openai_api_key
        });
        
        if (!orchestrator) {
            console.error('AI orchestrator not available - check OpenAI API key');
            socket.emit('error', { message: 'AI service not configured. Please check OpenAI API key.' });
            return;
        }
        
        // Initialize interview in orchestrator
        orchestrator.initializeInterview(interviewId, {
            candidate: {
                name: interview.candidateName,
                email: interview.candidateEmail
            },
            role: interview.role,
            customQuestions: interview.customQuestions
        });
        
        // Store session data
        socket.interviewId = interviewId;
        socket.orchestrator = orchestrator;
        socket.transcript = [];
        
        // Get greeting from orchestrator
        try {
            console.log('Getting greeting from orchestrator for interview:', interviewId);
            const response = await orchestrator.handleInteraction(interviewId);
            console.log('Orchestrator response:', {
                type: response.type,
                phase: response.phase,
                textLength: response.text?.length,
                expectingResponse: response.expectingResponse
            });
            
            let audio = null;
            try {
                audio = await voiceService.generateSpeech(response.text);
                console.log('Audio generated:', !!audio);
            } catch (audioError) {
                console.error('Audio generation failed:', audioError);
                // Continue without audio
            }
            
            socket.emit('ai-speaks', {
                text: response.text,
                audio: audio,
                type: response.type,
                phase: response.phase,
                questionIndex: response.questionIndex || 0,
                expectingResponse: response.expectingResponse
            });
            
            console.log('ai-speaks event emitted for greeting');
            
            // Add to transcript
            socket.transcript.push({
                speaker: 'AI',
                text: response.text,
                timestamp: new Date().toISOString()
            });
            
            // Update interview with questions count
            const interviewData = orchestrator.interviews.get(interviewId);
            socket.emit('interview-info', {
                totalQuestions: interviewData.questions.length,
                role: interview.role
            });
            
        } catch (error) {
            console.error('Error generating greeting:', error);
            socket.emit('error', { message: 'Failed to start interview' });
        }
    });
    
    // Simplified - no longer need ready-for-question event
    // The orchestrator handles all flow internally
    
    socket.on('candidate-response', async (data) => {
        const { text } = data;
        
        if (!socket.interviewId || !socket.orchestrator) return;
        
        // Add to transcript
        socket.transcript.push({
            speaker: 'Candidate',
            text,
            timestamp: new Date().toISOString()
        });
        
        try {
            // Process the response through the orchestrator
            const response = await socket.orchestrator.handleInteraction(socket.interviewId, text);
            
            console.log(`[Interview ${socket.interviewId}] Response:`, {
                type: response.type,
                phase: response.phase,
                expectingResponse: response.expectingResponse
            });
            
            // Generate audio
            let audio = null;
            try {
                audio = await voiceService.generateSpeech(response.text);
            } catch (audioError) {
                console.error('Audio generation failed:', audioError);
                // Continue without audio
            }
            
            // Send unified response to client
            socket.emit('ai-speaks', {
                text: response.text,
                audio: audio,
                type: response.type,
                phase: response.phase,
                questionIndex: response.questionIndex,
                expectingResponse: response.expectingResponse
            });
            
            // Add AI response to transcript
            socket.transcript.push({
                speaker: 'AI',
                text: response.text,
                timestamp: new Date().toISOString()
            });
            
            // Check if interview is completed
            if (response.phase === 'completed') {
                setTimeout(() => completeInterview(socket), 3000);
            }
            
        } catch (error) {
            console.error('Error processing response:', error);
            socket.emit('error', { message: 'Failed to process response' });
        }
    });
    
    socket.on('save-recording', async (data) => {
        console.log('Received save-recording request for interview:', socket.interviewId);
        console.log('Recording metadata:', {
            hasRecording: !!data.recording,
            error: data.error,
            mimeType: data.mimeType,
            chunks: data.chunks,
            size: data.size
        });
        
        if (!socket.interviewId) {
            console.error('No interview ID on socket');
            socket.emit('recording-saved', { 
                success: false, 
                error: 'No interview ID' 
            });
            return;
        }
        
        try {
            if (!data.recording) {
                console.error('No recording data received:', data.error || 'Unknown error');
                socket.emit('recording-saved', { 
                    success: false, 
                    error: data.error || 'No recording data' 
                });
                return;
            }
            
            // Extract base64 data
            const base64Data = data.recording.split(',')[1];
            if (!base64Data) {
                console.error('Invalid recording format - no base64 data found');
                socket.emit('recording-saved', { 
                    success: false, 
                    error: 'Invalid recording format' 
                });
                return;
            }
            
            console.log('Base64 data length:', base64Data.length);
            
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');
            const fileSizeMB = buffer.length / 1024 / 1024;
            console.log('Buffer size:', buffer.length, 'bytes (', fileSizeMB.toFixed(2), 'MB)');
            
            // Check file size limit
            if (fileSizeMB > appConfig.recording_settings.maxFileSizeMB) {
                console.error('Recording too large:', fileSizeMB.toFixed(2), 'MB > ', appConfig.recording_settings.maxFileSizeMB, 'MB');
                socket.emit('recording-saved', { 
                    success: false, 
                    error: `Recording too large: ${fileSizeMB.toFixed(2)}MB exceeds ${appConfig.recording_settings.maxFileSizeMB}MB limit` 
                });
                return;
            }
            
            // Save recording blob
            const recordingPath = path.join(__dirname, 'data/recordings', `${socket.interviewId}.webm`);
            console.log('Saving recording to:', recordingPath);
            
            await fs.mkdir(path.dirname(recordingPath), { recursive: true });
            
            await fs.writeFile(recordingPath, buffer);
            
            // Verify file was saved
            const stats = await fs.stat(recordingPath);
            console.log('Recording saved successfully:');
            console.log('- File size:', stats.size, 'bytes');
            console.log('- File path:', recordingPath);
            console.log('- Interview ID:', socket.interviewId);
            
            // Notify client that recording was saved
            socket.emit('recording-saved', { 
                success: true, 
                size: stats.size,
                path: recordingPath 
            });
        } catch (error) {
            console.error('Error saving recording:', error);
            console.error('Stack trace:', error.stack);
            
            // Notify client of error
            socket.emit('recording-saved', { 
                success: false, 
                error: error.message 
            });
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
    
    // Calculate duration
    const duration = new Date(interview.completedAt) - new Date(interview.startedAt);
    const durationMinutes = Math.floor(duration / 60000);
    
    // Get AI evaluation from orchestrator
    let evaluation = null;
    const orchestrator = getAIOrchestrator();
    if (orchestrator) {
        try {
            const interviewSummary = orchestrator.getInterviewSummary(socket.interviewId);
            if (interviewSummary) {
                // Use GPT-4-turbo for evaluation
                const openai = new OpenAI({ apiKey: appConfig.openai_api_key });
                const evalPrompt = `Evaluate this ${interviewSummary.role} interview:

Candidate: ${interviewSummary.candidate.name}
Duration: ${interviewSummary.duration} minutes
Questions Asked: ${interviewSummary.questionCount}

Interview Responses:
${interviewSummary.responses.map((r, i) => 
    `Q${i+1}: ${r.question}\nA: ${r.answer}\n`
).join('\n')}

Provide a professional evaluation covering:
1. Technical/role competency (based on answers)
2. Communication skills
3. Problem-solving approach
4. Cultural fit indicators
5. Overall recommendation

Be specific and reference actual answers.`;

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    messages: [
                        { role: 'system', content: 'You are an experienced interviewer providing candidate evaluation.' },
                        { role: 'user', content: evalPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                });
                
                evaluation = completion.choices[0].message.content;
            }
        } catch (error) {
            console.error('Error getting AI evaluation:', error);
            // Fallback to legacy evaluation if orchestrator fails
            const transcriptText = socket.transcript
                .map(entry => `${entry.speaker}: ${entry.text}`)
                .join('\n\n');
            evaluation = await aiInterviewer.evaluateCandidate(transcriptText, interview.role, interview.jobDescription);
        }
    } else {
        // Fallback to legacy evaluation
        const transcriptText = socket.transcript
            .map(entry => `${entry.speaker}: ${entry.text}`)
            .join('\n\n');
        evaluation = await aiInterviewer.evaluateCandidate(transcriptText, interview.role, interview.jobDescription);
    }
    
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
    We've completed all the questions. Your responses have been recorded and will be reviewed by the hiring team. 
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
    // Show appropriate URL based on environment
    const isReplit = process.env.REPL_SLUG && process.env.REPL_OWNER;
    if (isReplit) {
        console.log(`\n🚀 Senbird Interview System is running!`);
        console.log(`\n🔗 Your app URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    } else {
        console.log(`\n🚀 Senbird Interview System running on http://localhost:${PORT}`);
    }
    console.log('\n📋 Required API Keys:');
    console.log(`   OpenAI API: ${appConfig.openai_api_key ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   ElevenLabs: ${appConfig.elevenlabs_api_key ? '✅ Configured' : '❌ Missing'}`);
    console.log('\n🔗 Endpoints:');
    console.log(`   HR Dashboard: http://localhost:${PORT}`);
    console.log(`   Create Interview: POST /api/interviews/create`);
    console.log(`   Interview Room: /interview/:id`);
    console.log(`   View Results: /results/:id\n`);
});