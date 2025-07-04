const { Server } = require('socket.io');
const InterviewAI = require('../logic/interview_ai');
const ElevenLabsService = require('../utils/elevenlabs_service');
const { v4: uuidv4 } = require('uuid');

class WebRTCInterviewServer {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.activeSessions = new Map();
        this.interviewAI = new InterviewAI();
        this.elevenLabsService = new ElevenLabsService();
        
        this.setupSocketHandlers();
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            
            // Handle interview join
            socket.on('join-interview', async (data) => {
                const { sessionId, role } = data;
                console.log(`Client joining interview: ${sessionId} as ${role}`);
                
                // Join room
                socket.join(sessionId);
                
                // Initialize session if needed
                if (!this.activeSessions.has(sessionId)) {
                    await this.initializeSession(sessionId);
                }
                
                const session = this.activeSessions.get(sessionId);
                
                // Start interview flow
                if (role === 'candidate' && session.status === 'waiting') {
                    await this.startInterview(sessionId, socket);
                }
            });
            
            // Handle candidate responses
            socket.on('candidate-response', async (data) => {
                const { sessionId, text, questionIndex } = data;
                console.log(`Candidate response for session ${sessionId}:`, text);
                
                const session = this.activeSessions.get(sessionId);
                if (!session) return;
                
                // Store response
                if (!session.responses[questionIndex]) {
                    session.responses[questionIndex] = {
                        question: session.questions[questionIndex].text,
                        response: text,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Process with AI
                await this.processResponse(sessionId, text, questionIndex, socket);
            });
            
            // Handle interview end
            socket.on('end-interview', async (data) => {
                const { sessionId } = data;
                await this.endInterview(sessionId);
            });
            
            // Handle disconnect
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }
    
    async initializeSession(sessionId) {
        console.log('Initializing session:', sessionId);
        
        // Load interview questions and role
        // In a real implementation, this would come from the database
        const roleSlug = 'customer_support_specialist'; // Default for now
        const roleTemplate = await this.interviewAI.loadRoleTemplate(roleSlug);
        
        // Prepare questions with audio
        const questions = await this.prepareQuestions(roleTemplate);
        
        const session = {
            id: sessionId,
            status: 'waiting',
            role: roleTemplate.role,
            roleSlug: roleSlug,
            questions: questions,
            currentQuestionIndex: -1,
            responses: [],
            startTime: null,
            endTime: null,
            transcript: []
        };
        
        this.activeSessions.set(sessionId, session);
        return session;
    }
    
    async prepareQuestions(roleTemplate) {
        const questions = [];
        
        // Technical questions
        for (const q of roleTemplate.questions) {
            const audioUrl = await this.generateAudioForText(q);
            questions.push({
                type: 'technical',
                text: q,
                audioUrl: audioUrl
            });
        }
        
        // Behavioral questions
        for (const q of roleTemplate.behavioral_questions) {
            const audioUrl = await this.generateAudioForText(q);
            questions.push({
                type: 'behavioral',
                text: q,
                audioUrl: audioUrl
            });
        }
        
        return questions;
    }
    
    async startInterview(sessionId, socket) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        console.log('Starting interview for session:', sessionId);
        session.status = 'active';
        session.startTime = new Date().toISOString();
        
        // Generate greeting
        const greetingText = `Hello! I'm your AI interviewer today. I'll be conducting this interview for the ${session.role} position. 
        I'll ask you a series of questions, and I'd like you to take your time and answer each one thoughtfully. 
        Please speak clearly, and feel free to ask me to repeat any question if needed. 
        Are you ready to begin?`;
        
        const greetingAudio = await this.generateAudioForText(greetingText);
        
        // Send interview started event
        socket.emit('interview-started', {
            sessionId: sessionId,
            role: session.role,
            totalQuestions: session.questions.length,
            greeting: greetingText,
            greetingAudio: greetingAudio
        });
        
        // Add to transcript
        session.transcript.push({
            speaker: 'AI',
            text: greetingText,
            timestamp: new Date().toISOString()
        });
        
        // Wait a bit then ask first question
        setTimeout(() => {
            this.askNextQuestion(sessionId, socket);
        }, 15000); // Give candidate time to respond to greeting
    }
    
    async askNextQuestion(sessionId, socket) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        session.currentQuestionIndex++;
        
        // Check if we have more questions
        if (session.currentQuestionIndex >= session.questions.length) {
            await this.endInterview(sessionId);
            return;
        }
        
        const question = session.questions[session.currentQuestionIndex];
        console.log(`Asking question ${session.currentQuestionIndex + 1}:`, question.text);
        
        // Send question to candidate
        socket.to(sessionId).emit('ai-question', {
            sessionId: sessionId,
            questionIndex: session.currentQuestionIndex,
            text: question.text,
            audioUrl: question.audioUrl
        });
        
        // Add to transcript
        session.transcript.push({
            speaker: 'AI',
            text: question.text,
            timestamp: new Date().toISOString()
        });
    }
    
    async processResponse(sessionId, responseText, questionIndex, socket) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        // Add response to transcript
        session.transcript.push({
            speaker: 'Candidate',
            text: responseText,
            timestamp: new Date().toISOString()
        });
        
        // Generate AI feedback/follow-up
        const aiResponse = await this.generateAIResponse(session, responseText, questionIndex);
        
        if (aiResponse.type === 'follow-up') {
            // Send follow-up question
            const audioUrl = await this.generateAudioForText(aiResponse.text);
            
            socket.to(sessionId).emit('ai-response', {
                sessionId: sessionId,
                type: 'follow-up',
                text: aiResponse.text,
                audioUrl: audioUrl
            });
            
            session.transcript.push({
                speaker: 'AI',
                text: aiResponse.text,
                timestamp: new Date().toISOString()
            });
        } else {
            // Send acknowledgment and move to next question
            const audioUrl = await this.generateAudioForText(aiResponse.text);
            
            socket.to(sessionId).emit('ai-response', {
                sessionId: sessionId,
                type: 'acknowledgment',
                text: aiResponse.text,
                audioUrl: audioUrl
            });
            
            session.transcript.push({
                speaker: 'AI',
                text: aiResponse.text,
                timestamp: new Date().toISOString()
            });
            
            // Move to next question after a short delay
            setTimeout(() => {
                this.askNextQuestion(sessionId, socket);
            }, 3000);
        }
    }
    
    async generateAIResponse(session, responseText, questionIndex) {
        const question = session.questions[questionIndex];
        
        // Use Claude to analyze response and generate appropriate follow-up
        const prompt = `You are an AI interviewer. The candidate was asked: "${question.text}"
        
        Their response was: "${responseText}"
        
        Analyze their response and decide:
        1. If the response is complete and clear, provide a brief acknowledgment (1-2 sentences) and indicate we should move to the next question
        2. If the response is vague or incomplete, ask ONE specific follow-up question to get more details
        
        Respond in JSON format:
        {
            "type": "acknowledgment" or "follow-up",
            "text": "Your response text here"
        }`;
        
        try {
            const analysis = await this.interviewAI.analyzeResponse(prompt);
            return JSON.parse(analysis);
        } catch (error) {
            console.error('Error generating AI response:', error);
            // Default acknowledgment
            return {
                type: 'acknowledgment',
                text: 'Thank you for your answer. Let me move on to the next question.'
            };
        }
    }
    
    async generateAudioForText(text) {
        try {
            if (!process.env.ELEVENLABS_API_KEY) {
                console.warn('ElevenLabs not configured, skipping audio generation');
                return null;
            }
            
            const audioUrl = await this.elevenLabsService.generateSpeech(text, {
                voice: 'rachel',
                model: 'eleven_monolingual_v1'
            });
            
            return audioUrl;
        } catch (error) {
            console.error('Error generating audio:', error);
            return null;
        }
    }
    
    async endInterview(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        console.log('Ending interview:', sessionId);
        session.status = 'completed';
        session.endTime = new Date().toISOString();
        
        // Calculate duration
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const durationMs = end - start;
        const duration = `${Math.floor(durationMs / 60000)} minutes`;
        
        // Generate closing message
        const closingText = `Thank you so much for your time today. We've completed all the interview questions. 
        Your responses have been recorded and will be reviewed by our team. 
        We appreciate your interest in the ${session.role} position and will be in touch soon with next steps. 
        Have a great day!`;
        
        const closingAudio = await this.generateAudioForText(closingText);
        
        // Notify all clients in the room
        this.io.to(sessionId).emit('interview-ended', {
            sessionId: sessionId,
            duration: duration,
            questionsAnswered: session.responses.length,
            message: closingText,
            audioUrl: closingAudio
        });
        
        // Save interview data
        await this.saveInterviewData(session);
        
        // Clean up session after a delay
        setTimeout(() => {
            this.activeSessions.delete(sessionId);
        }, 60000); // Keep for 1 minute for any final operations
    }
    
    async saveInterviewData(session) {
        // In a real implementation, this would save to database
        // For now, just log the summary
        console.log('Interview Summary:', {
            sessionId: session.id,
            role: session.role,
            duration: session.endTime ? 
                new Date(session.endTime) - new Date(session.startTime) : 0,
            questionsAsked: session.currentQuestionIndex + 1,
            responsesReceived: session.responses.filter(r => r).length,
            transcriptLength: session.transcript.length
        });
        
        // Could also:
        // - Generate evaluation using Claude
        // - Save recording if available
        // - Send notification emails
        // - Update candidate status in database
    }
}

module.exports = WebRTCInterviewServer;