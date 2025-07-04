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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
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
    interview_guidelines: {
        // Conversation Flow
        pace: 'normal', // 'slow', 'normal', 'fast'
        style: 'professional', // 'casual', 'professional', 'friendly', 'empathetic'
        waitTime: 2000, // ms to wait between questions
        
        // Follow-up Behavior
        followUpFrequency: 0.3, // 0-1 probability of follow-up questions
        maxFollowUps: 2, // max follow-ups per question
        followUpDepth: 'balanced', // 'surface', 'balanced', 'deep'
        
        // Natural Conversation Settings
        useFillers: true, // Use "I see", "That's interesting", etc.
        acknowledgements: true, // Acknowledge answers before moving on
        personalizedResponses: true, // Reference previous answers
        
        // Interview Dynamics
        warmupQuestions: 1, // Number of easy warmup questions
        difficulty_progression: 'gradual', // 'flat', 'gradual', 'steep'
        encouragement_level: 'moderate', // 'none', 'minimal', 'moderate', 'high'
        
        // Probing Techniques
        clarificationStyle: 'gentle', // 'direct', 'gentle', 'persistent'
        silenceHandling: 'patient', // 'immediate', 'patient', 'very_patient'
        redirectTechnique: 'subtle', // 'direct', 'subtle', 'none'
        
        // Custom Instructions
        customInstructions: '',
        personality_traits: [] // e.g., ['warm', 'analytical', 'curious']
    },
    
    // AI Behavior Templates
    ai_templates: {
        'technical_senior': {
            name: 'Senior Technical Interview',
            description: 'For experienced technical candidates',
            settings: {
                style: 'professional',
                followUpDepth: 'deep',
                difficulty_progression: 'steep',
                clarificationStyle: 'persistent'
            }
        },
        'entry_friendly': {
            name: 'Entry Level Friendly',
            description: 'Encouraging for junior candidates',
            settings: {
                style: 'friendly',
                warmupQuestions: 2,
                encouragement_level: 'high',
                difficulty_progression: 'gradual'
            }
        }
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

// AI Interviewer Service
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
        return customQuestions && customQuestions.length > 0 ? customQuestions : this.defaultQuestions;
    }
    
    async getNextQuestion(index, questions, interviewId, previousResponse, jobDescription = '') {
        const questionSet = questions || this.defaultQuestions;
        if (index < questionSet.length) {
            // Get conversation context
            const history = this.conversationHistory.get(interviewId) || [];
            
            // Generate a conversational bridge if we have OpenAI configured
            const openai = this.getOpenAIClient();
            if (openai && previousResponse && index > 0) {
                try {
                    const jobContext = jobDescription ? 
                        `\n\nJob Description Context:\n${jobDescription.substring(0, 500)}...` : '';
                    
                    // Build system prompt based on guidelines
                    const guidelines = appConfig.interview_guidelines;
                    let systemPrompt = `You are a ${guidelines.style} interviewer conducting a real interview. `;
                    
                    // Style-specific instructions
                    if (guidelines.style === 'professional') {
                        systemPrompt += 'Maintain a formal yet approachable demeanor. ';
                    } else if (guidelines.style === 'casual') {
                        systemPrompt += 'Keep a relaxed, conversational tone like a friendly colleague. ';
                    } else if (guidelines.style === 'friendly') {
                        systemPrompt += 'Be warm, encouraging, and create a comfortable atmosphere. ';
                    } else if (guidelines.style === 'empathetic') {
                        systemPrompt += 'Show genuine interest and understanding in their experiences. ';
                    }
                    
                    // Natural conversation elements
                    if (guidelines.useFillers) {
                        systemPrompt += 'Use natural fillers like "I see", "That\'s interesting", "Mm-hmm" occasionally. ';
                    }
                    
                    if (guidelines.acknowledgements) {
                        systemPrompt += 'Always acknowledge their answer before moving on. ';
                    }
                    
                    if (guidelines.personalizedResponses && history.length > 0) {
                        systemPrompt += 'Reference something they mentioned earlier when relevant. ';
                    }
                    
                    // Encouragement settings
                    if (guidelines.encouragement_level === 'high') {
                        systemPrompt += 'Be very encouraging and positive about their responses. ';
                    } else if (guidelines.encouragement_level === 'moderate') {
                        systemPrompt += 'Offer moderate encouragement when appropriate. ';
                    }
                    
                    // Personality traits
                    if (guidelines.personality_traits && guidelines.personality_traits.length > 0) {
                        systemPrompt += `Embody these traits: ${guidelines.personality_traits.join(', ')}. `;
                    }
                    
                    systemPrompt += `\n\nAcknowledge their response naturally and transition to the next question. 
                    Make it feel like a real conversation, not a scripted interview. 
                    Keep acknowledgment to 1-3 sentences.${jobContext}`;
                    
                    if (guidelines.customInstructions) {
                        systemPrompt += `\n\nAdditional instructions: ${guidelines.customInstructions}`;
                    }
                    
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o', // Fast, multimodal model for real-time voice interactions
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Previous question: ${questionSet[index-1]}\n\nCandidate's response: ${previousResponse}\n\nNext question to ask: ${questionSet[index]}\n\nProvide a natural transition that acknowledges their answer and leads into the next question.`
                            }
                        ],
                        max_tokens: 200,
                        temperature: 0.8
                    });
                    
                    return response.choices[0].message.content;
                } catch (error) {
                    console.error('Error generating conversational response:', error);
                }
            }
            
            return questionSet[index];
        }
        return null;
    }
    
    async generateFollowUp(interviewId, question, response, followUpCount = 0) {
        const openai = this.getOpenAIClient();
        if (!openai) return null;
        
        const guidelines = appConfig.interview_guidelines;
        
        // Check if we should ask a follow-up
        if (followUpCount >= guidelines.maxFollowUps) {
            return null;
        }
        
        // Adjust probability based on response length and depth settings
        let shouldFollowUp = Math.random() < guidelines.followUpFrequency;
        
        if (response.length < 50 && guidelines.followUpDepth === 'deep') {
            shouldFollowUp = true; // Always follow up on very short answers
        } else if (response.length > 300 && guidelines.followUpDepth === 'surface') {
            shouldFollowUp = false; // Don't follow up on detailed answers
        }
        
        if (!shouldFollowUp) {
            return null;
        }
        
        try {
            const history = this.conversationHistory.get(interviewId) || [];
            
            // Build follow-up prompt based on guidelines
            let systemPrompt = `You are a ${guidelines.style} interviewer. `;
            
            if (guidelines.clarificationStyle === 'gentle') {
                systemPrompt += 'Ask gentle, non-confrontational follow-up questions. ';
            } else if (guidelines.clarificationStyle === 'direct') {
                systemPrompt += 'Ask direct, specific follow-up questions. ';
            } else if (guidelines.clarificationStyle === 'persistent') {
                systemPrompt += 'Be persistent in getting detailed information. ';
            }
            
            systemPrompt += `Based on the candidate's response, generate a brief follow-up question that:
            - Probes deeper into their answer
            - Asks for specific examples if they gave general answers
            - Clarifies any vague points
            - Shows genuine interest in their experience
            
            If the answer is already complete and detailed, return "NO_FOLLOWUP".
            Keep the follow-up natural and conversational.`;
            
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o', // Fast model for real-time follow-up questions
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `Question asked: ${question}\n\nCandidate's response: ${response}\n\nGenerate an appropriate follow-up question or return NO_FOLLOWUP.`
                    }
                ],
                max_tokens: 100,
                temperature: 0.7
            });
            
            const followUp = completion.choices[0].message.content;
            return followUp.toLowerCase().includes('null') ? null : followUp;
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
    const { openai_api_key, elevenlabs_api_key, elevenlabs_voice_id, interview_guidelines } = req.body;
    
    // Update config
    if (openai_api_key !== undefined) appConfig.openai_api_key = openai_api_key;
    if (elevenlabs_api_key !== undefined) appConfig.elevenlabs_api_key = elevenlabs_api_key;
    if (elevenlabs_voice_id !== undefined) appConfig.elevenlabs_voice_id = elevenlabs_voice_id;
    if (interview_guidelines !== undefined) appConfig.interview_guidelines = { ...appConfig.interview_guidelines, ...interview_guidelines };
    
    // Save to file
    await saveConfig();
    
    res.json({ 
        success: true,
        message: 'Settings saved successfully'
    });
});

// Get interview guidelines
app.get('/api/settings/guidelines', (req, res) => {
    res.json({
        success: true,
        guidelines: appConfig.interview_guidelines
    });
});

// Check if API keys are configured
app.get('/api/settings/check', (req, res) => {
    res.json({
        openai: !!appConfig.openai_api_key,
        elevenlabs: !!appConfig.elevenlabs_api_key,
        voice_id: appConfig.elevenlabs_voice_id
    });
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
        
        // Get questions for this interview
        const questions = interview.customQuestions.length > 0 ? 
            interview.customQuestions : 
            aiInterviewer.defaultQuestions;
        
        // Start interview with greeting
        const greeting = `Hello ${interview.candidateName}! I'm your interviewer from Senbird today. 
        I'll be asking you some questions about your background and experience for the ${interview.role} position. 
        Please speak clearly and take your time with each answer. Let's begin!`;
        
        const greetingAudio = await voiceService.generateSpeech(greeting);
        
        socket.emit('interview-started', {
            interview,
            greeting,
            greetingAudio,
            totalQuestions: questions.length
        });
        
        // Store session data
        socket.interviewId = interviewId;
        socket.questions = questions;
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
        const previousResponse = socket.questionIndex > 0 ? 
            socket.responses[socket.responses.length - 1]?.response : null;
        
        const interview = interviews.get(socket.interviewId);
        const question = await aiInterviewer.getNextQuestion(
            socket.questionIndex, 
            socket.questions,
            socket.interviewId,
            previousResponse,
            interview ? interview.jobDescription : ''
        );
        
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
            
            aiInterviewer.updateConversationHistory(socket.interviewId, 'AI', question);
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
            question: socket.questions[socket.questionIndex],
            response: text,
            timestamp: new Date().toISOString()
        });
        
        aiInterviewer.updateConversationHistory(socket.interviewId, 'Candidate', text);
        
        // Check if we should ask a follow-up question
        const followUp = await aiInterviewer.generateFollowUp(
            socket.interviewId,
            socket.questions[socket.questionIndex],
            text
        );
        
        if (followUp && Math.random() < appConfig.interview_guidelines.followUpFrequency) {
            const followUpAudio = await voiceService.generateSpeech(followUp);
            socket.emit('ai-followup', {
                text: followUp,
                audio: followUpAudio
            });
            
            socket.transcript.push({
                speaker: 'AI',
                text: followUp,
                timestamp: new Date().toISOString()
            });
            
            aiInterviewer.updateConversationHistory(socket.interviewId, 'AI', followUp);
            socket.expectingFollowUp = true;
        } else {
            // Simple acknowledgment for smooth transitions
            const acks = [
                "Thank you for sharing that.",
                "I appreciate your response.",
                "That's interesting, thank you.",
                "Thank you, that's helpful to know."
            ];
            const ack = acks[Math.floor(Math.random() * acks.length)];
            const ackAudio = await voiceService.generateSpeech(ack);
            
            socket.emit('ai-acknowledgment', {
                text: ack,
                audio: ackAudio,
                waitTime: appConfig.interview_guidelines.waitTime // Add wait time before next question
            });
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
            
            // Save recording blob
            const recordingPath = path.join(__dirname, 'data/recordings', `${socket.interviewId}.webm`);
            console.log('Saving recording to:', recordingPath);
            
            await fs.mkdir(path.dirname(recordingPath), { recursive: true });
            
            const buffer = Buffer.from(base64Data, 'base64');
            console.log('Buffer size:', buffer.length, 'bytes (', (buffer.length / 1024 / 1024).toFixed(2), 'MB)');
            
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
    
    // Create transcript text
    const transcriptText = socket.transcript
        .map(entry => `${entry.speaker}: ${entry.text}`)
        .join('\n\n');
    
    // Get AI evaluation
    const evaluation = await aiInterviewer.evaluateCandidate(transcriptText, interview.role, interview.jobDescription);
    
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
    We've completed all the questions. Your responses have been recorded and will be reviewed by the Senbird team. 
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