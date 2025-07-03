const ElevenLabsVoiceService = require('../utils/elevenlabs_voice_service');
const RecallRecordingService = require('../utils/recall_recording_service');
const InterviewAI = require('./interview_ai');
const Evaluator = require('./evaluator');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class AutomatedInterviewSystem {
    constructor() {
        this.voiceService = new ElevenLabsVoiceService();
        this.recordingService = new RecallRecordingService();
        this.interviewAI = new InterviewAI();
        this.evaluator = new Evaluator();
        this.activeSessions = new Map();
    }

    async startInterview(candidateName, email, roleSlug, meetUrl) {
        const sessionId = uuidv4();
        
        try {
            // Load role template
            const roleTemplate = await this.loadRoleBySlug(roleSlug);
            if (!roleTemplate) {
                throw new Error('Role not found');
            }

            // Create session
            const session = {
                id: sessionId,
                candidateName,
                email,
                role: roleTemplate.role,
                roleTemplate,
                meetUrl,
                startedAt: new Date().toISOString(),
                status: 'initializing',
                responses: [],
                currentQuestionIndex: 0
            };

            this.activeSessions.set(sessionId, session);

            // Start recording if available
            if (process.env.RECALL_API_KEY) {
                const recordingBot = await this.recordingService.createBot(
                    meetUrl,
                    sessionId,
                    { candidateName, role: roleTemplate.role }
                );
                session.recordingBotId = recordingBot?.botId;
            }

            // Generate interview questions with voice
            await this.prepareInterviewQuestions(session);

            session.status = 'ready';
            return session;
        } catch (error) {
            console.error('Failed to start interview:', error);
            throw error;
        }
    }

    async loadRoleBySlug(roleSlug) {
        try {
            const files = await fs.readdir(path.join(__dirname, '../roles'));
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(__dirname, '../roles', file), 'utf8');
                    const role = JSON.parse(content);
                    const slug = role.role.toLowerCase().replace(/\s+/g, '_');
                    if (slug === roleSlug) {
                        return role;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error loading role:', error);
            return null;
        }
    }

    async prepareInterviewQuestions(session) {
        const { roleTemplate } = session;
        const allQuestions = [];

        // Welcome message
        const welcomeText = `Hello ${session.candidateName}! Welcome to your interview for the ${roleTemplate.role} position. I'm Claude, your AI interviewer today. I'll be asking you a series of questions to learn more about your experience and qualifications. Please take your time with each answer. Let's begin!`;
        
        allQuestions.push({
            type: 'welcome',
            text: welcomeText,
            audioUrl: await this.generateVoiceAudio(welcomeText)
        });

        // Role-specific questions
        for (let i = 0; i < roleTemplate.questions.length; i++) {
            const questionText = `Question ${i + 1}: ${roleTemplate.questions[i]}`;
            allQuestions.push({
                type: 'role_question',
                index: i,
                text: roleTemplate.questions[i],
                audioUrl: await this.generateVoiceAudio(questionText)
            });
        }

        // Behavioral questions
        for (let i = 0; i < roleTemplate.behavioral_questions.length; i++) {
            const questionText = `Behavioral question ${i + 1}: ${roleTemplate.behavioral_questions[i]}`;
            allQuestions.push({
                type: 'behavioral_question',
                index: i,
                text: roleTemplate.behavioral_questions[i],
                audioUrl: await this.generateVoiceAudio(questionText)
            });
        }

        // Closing
        const closingText = `Thank you so much for your time today, ${session.candidateName}. We really appreciate you sharing your experiences with us. We'll be in touch soon about next steps. Have a great day!`;
        allQuestions.push({
            type: 'closing',
            text: closingText,
            audioUrl: await this.generateVoiceAudio(closingText)
        });

        session.questions = allQuestions;
    }

    async generateVoiceAudio(text) {
        if (!process.env.ELEVENLABS_API_KEY) {
            return null;
        }

        try {
            const audio = await this.voiceService.textToSpeech(text, {
                stability: 0.7,
                similarityBoost: 0.8
            });
            return audio?.filepath;
        } catch (error) {
            console.error('Failed to generate voice:', error);
            return null;
        }
    }

    async getNextQuestion(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        const question = session.questions[session.currentQuestionIndex];
        if (question) {
            session.status = 'asking_question';
            return question;
        }

        return null;
    }

    async submitAnswer(sessionId, answer) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;

        const currentQuestion = session.questions[session.currentQuestionIndex];
        
        session.responses.push({
            question: currentQuestion.text,
            type: currentQuestion.type,
            answer: answer,
            timestamp: new Date().toISOString()
        });

        session.currentQuestionIndex++;
        
        // Check if interview is complete
        if (session.currentQuestionIndex >= session.questions.length) {
            await this.completeInterview(sessionId);
        }

        return true;
    }

    async completeInterview(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        session.status = 'completed';
        session.completedAt = new Date().toISOString();

        // Stop recording
        let recordingUrl = null;
        if (session.recordingBotId) {
            const recording = await this.recordingService.getRecording(session.recordingBotId);
            recordingUrl = recording?.video_url;
        }

        // Evaluate the interview
        const evaluation = await this.evaluator.evaluateInterview(
            {
                sessionId,
                candidateName: session.candidateName,
                responses: session.responses,
                videoUrl: recordingUrl
            },
            session.roleTemplate
        );

        // Calculate scores based on job requirements
        const scores = await this.calculateScores(session, evaluation);

        // Save result
        const result = {
            id: sessionId,
            candidateName: session.candidateName,
            email: session.email,
            role: session.role,
            completedAt: session.completedAt,
            duration: this.calculateDuration(session.startedAt, session.completedAt),
            overallScore: scores.overall,
            communicationScore: scores.communication,
            technicalScore: scores.technical,
            culturalFitScore: scores.cultural,
            summary: evaluation.summary,
            strengths: evaluation.strengths,
            weaknesses: evaluation.flags,
            recommendedActions: evaluation.suggested_followups,
            recordingUrl,
            responses: session.responses
        };

        await this.saveResult(result);
        this.activeSessions.delete(sessionId);

        return result;
    }

    async calculateScores(session, evaluation) {
        const { roleTemplate, responses } = session;
        
        // Base scores from AI evaluation
        let technicalScore = evaluation.technical_readiness === 'Ready with minimal training' ? 8 : 
                           evaluation.technical_readiness === 'Requires some training' ? 6 : 4;
        
        // Adjust based on requirements matching
        const requirementMatches = await this.matchRequirements(responses, roleTemplate.requirements);
        technicalScore = Math.min(10, technicalScore + (requirementMatches * 0.5));

        // Cultural fit based on traits
        const traitMatches = await this.matchTraits(responses, roleTemplate.traits);
        const culturalScore = Math.min(10, 5 + (traitMatches * 1));

        return {
            overall: evaluation.fit_score || Math.round((technicalScore + evaluation.communication_score + culturalScore) / 3),
            communication: evaluation.communication_score || 7,
            technical: Math.round(technicalScore),
            cultural: Math.round(culturalScore)
        };
    }

    async matchRequirements(responses, requirements) {
        // Simple keyword matching - in production, use more sophisticated NLP
        let matches = 0;
        const responseText = responses.map(r => r.answer).join(' ').toLowerCase();
        
        requirements.forEach(req => {
            const keywords = req.toLowerCase().split(/\s+/);
            if (keywords.some(keyword => responseText.includes(keyword))) {
                matches++;
            }
        });

        return (matches / requirements.length) * 10;
    }

    async matchTraits(responses, traits) {
        // Analyze responses for trait indicators
        let matches = 0;
        const responseText = responses.map(r => r.answer).join(' ').toLowerCase();
        
        traits.forEach(trait => {
            // Simple presence check - enhance with sentiment analysis
            if (responseText.includes(trait.toLowerCase())) {
                matches++;
            }
        });

        return (matches / traits.length) * 10;
    }

    calculateDuration(start, end) {
        const duration = new Date(end) - new Date(start);
        const minutes = Math.floor(duration / 60000);
        return `${minutes} minutes`;
    }

    async saveResult(result) {
        try {
            const resultsPath = path.join(__dirname, '../../data/results.json');
            let results = [];
            
            try {
                const content = await fs.readFile(resultsPath, 'utf8');
                results = JSON.parse(content);
            } catch (error) {
                // File doesn't exist yet
            }

            results.push(result);
            
            // Keep only last 1000 results
            if (results.length > 1000) {
                results = results.slice(-1000);
            }

            await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
            console.log('Interview result saved:', result.id);
        } catch (error) {
            console.error('Error saving result:', error);
        }
    }

    getActiveSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }
}

module.exports = AutomatedInterviewSystem;