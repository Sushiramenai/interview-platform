const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const ElevenLabsVoiceService = require('../utils/elevenlabs_voice_service');

class InterviewAI {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.CLAUDE_API_KEY,
        });
        this.voiceService = new ElevenLabsVoiceService();
    }

    async loadRoleTemplate(roleName) {
        try {
            const filename = roleName.toLowerCase().replace(/\s+/g, '_') + '.json';
            const filePath = path.join(__dirname, '../roles', filename);
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error loading role template:', error);
            // Return default template if role not found
            return {
                role: 'General',
                traits: ['professional', 'articulate', 'thoughtful'],
                questions: [
                    'Tell me about yourself and your background.',
                    'What interests you about this opportunity?',
                    'What are your key strengths?',
                    'Where do you see yourself in 5 years?'
                ],
                behavioral_questions: [
                    'Tell me about a time you faced a challenge and how you overcame it.',
                    'Describe a situation where you had to work with a difficult team member.'
                ]
            };
        }
    }

    async generateInterviewerPersona(roleTemplate) {
        const prompt = `You are an AI interviewer conducting a video interview for the role of ${roleTemplate.role}. 
        You should embody these traits: ${roleTemplate.traits.join(', ')}.
        
        Your communication style should be:
        - Professional yet warm
        - Clear and concise
        - Encouraging but not overly casual
        - Patient and giving candidates time to think
        
        You will ask questions one at a time and wait for responses before proceeding.`;

        return prompt;
    }

    async conductInterview(sessionId, roleTemplate, onQuestion, onResponse) {
        const persona = await this.generateInterviewerPersona(roleTemplate);
        const allQuestions = [...roleTemplate.questions, ...roleTemplate.behavioral_questions];
        const responses = [];

        // Introduction
        const introText = `Hello! I'm your AI interviewer today. Thank you for taking the time to meet with us about the ${roleTemplate.role} position. I'll be asking you a series of questions to help us get to know you better. Please take your time with each answer, and feel free to ask me to repeat or clarify any question. Let's begin!`;
        
        // Generate voice audio if enabled
        let audioFile = null;
        if (this.voiceService.enabled) {
            audioFile = await this.voiceService.textToSpeech(introText);
        }
        
        await onQuestion({
            type: 'intro',
            text: introText,
            audio: audioFile
        });

        // Wait for acknowledgment
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Ask each question
        for (let i = 0; i < allQuestions.length; i++) {
            const question = allQuestions[i];
            const isBehavioral = roleTemplate.behavioral_questions.includes(question);
            
            await onQuestion({
                type: isBehavioral ? 'behavioral' : 'standard',
                number: i + 1,
                total: allQuestions.length,
                text: question
            });

            // Simulate waiting for response (in real implementation, this would be voice/video processing)
            const response = await onResponse();
            responses.push({
                question,
                type: isBehavioral ? 'behavioral' : 'standard',
                response,
                timestamp: new Date().toISOString()
            });

            // Generate follow-up if needed
            if (response && response.length < 50) {
                await onQuestion({
                    type: 'followup',
                    text: 'Could you elaborate on that a bit more? I\'d love to hear more details.'
                });
                const followup = await onResponse();
                responses[responses.length - 1].followup = followup;
            }
        }

        // Closing
        await onQuestion({
            type: 'closing',
            text: `Thank you so much for your time today! We really appreciate you sharing your experiences with us. Do you have any questions for me about the role or the company?`
        });

        const finalResponse = await onResponse();
        if (finalResponse) {
            responses.push({
                question: 'Candidate questions',
                type: 'candidate_question',
                response: finalResponse,
                timestamp: new Date().toISOString()
            });
        }

        return {
            sessionId,
            role: roleTemplate.role,
            responses,
            completedAt: new Date().toISOString()
        };
    }

    async generateSmartFollowUp(question, response) {
        try {
            const completion = await this.anthropic.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: 150,
                messages: [{
                    role: 'user',
                    content: `As an interviewer, generate a brief follow-up question based on this exchange:
                    Question: ${question}
                    Response: ${response}
                    
                    Generate a natural, probing follow-up question that digs deeper into their answer.`
                }]
            });

            return completion.content[0].text;
        } catch (error) {
            console.error('Error generating follow-up:', error);
            return 'Could you tell me more about that experience?';
        }
    }
}

module.exports = InterviewAI;