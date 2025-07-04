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
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/data/recordings', express.static(path.join(__dirname, 'data/recordings')));
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
        pace: 'normal', // 'slow', 'normal', 'fast'
        style: 'professional', // 'casual', 'professional', 'friendly'
        followUpFrequency: 0.3, // 0-1 probability of follow-up questions
        waitTime: 2000, // ms to wait between questions
        maxFollowUps: 2, // max follow-ups per question
        customInstructions: '' // custom AI behavior instructions
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
                    let systemPrompt = `You are a ${appConfig.interview_guidelines.style} interviewer. The candidate just answered a question.`;
                    
                    if (appConfig.interview_guidelines.style === 'professional') {
                        systemPrompt += ' Maintain a formal, structured approach.';
                    } else if (appConfig.interview_guidelines.style === 'casual') {
                        systemPrompt += ' Keep a relaxed, conversational tone.';
                    } else if (appConfig.interview_guidelines.style === 'friendly') {
                        systemPrompt += ' Be warm, encouraging, and supportive.';
                    }
                    
                    systemPrompt += ` Acknowledge their response briefly and naturally transition to the next question. 
                    Keep it conversational and empathetic. Maximum 2 sentences for the acknowledgment.${jobContext}`;
                    
                    if (appConfig.interview_guidelines.customInstructions) {
                        systemPrompt += `\n\nAdditional instructions: ${appConfig.interview_guidelines.customInstructions}`;
                    }
                    
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4',
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Previous question: ${questionSet[index-1]}\n\nCandidate's response: ${previousResponse}\n\nNext question to ask: ${questionSet[index]}`
                            }
                        ],
                        max_tokens: 150,
                        temperature: 0.7
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
    
    async generateFollowUp(interviewId, question, response) {
        const openai = this.getOpenAIClient();
        if (!openai) return null;
        
        try {
            const history = this.conversationHistory.get(interviewId) || [];
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are an empathetic, professional interviewer. Based on the candidate's response, 
                        decide if a brief follow-up question would be valuable. If yes, generate a short, 
                        clarifying follow-up question. If the answer is complete, return null. 
                        Keep follow-ups brief and relevant.`
                    },
                    {
                        role: 'user',
                        content: `Question asked: ${question}\n\nCandidate's response: ${response}`
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
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are evaluating a candidate for a ${role} position. Provide a thorough, 
                        fair evaluation. Be constructive and professional. Score fairly - 7-8 is excellent, 
                        9-10 is exceptional.${jobContext}`
                    },
                    {
                        role: 'user',
                        content: `Based on this interview transcript, provide:
1. A score from 1-10
2. A 2-3 sentence summary focusing on role fit
3. Key strengths relevant to the ${role} position (2-3 specific points)
4. Areas for improvement (2-3 constructive points)

Consider:
- Technical skills mentioned for the role
- Communication clarity and structure  
- Problem-solving approach
- Cultural fit indicators
- Relevant experience
${jobDescription ? '- Alignment with the specific requirements in the job description' : ''}

Transcript:
${transcript}

Respond in JSON format: { "score": 8, "summary": "...", "strengths": ["..."], "improvements": ["..."] }`
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500,
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
        interviewUrl: `/interview/${interviewId}`
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
                model: 'gpt-4',
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
            model: 'gpt-4',
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
            model: 'gpt-4',
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