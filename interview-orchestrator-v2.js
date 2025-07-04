/**
 * Professional Interview Orchestrator V2
 * 
 * This is a complete redesign based on interview best practices:
 * - Linear progression through interview phases
 * - Natural conversation flow
 * - Context-aware responses
 * - No loops or repetition
 */

class ProfessionalInterviewOrchestrator {
    constructor(openai) {
        this.openai = openai;
        this.interviews = new Map();
        
        // Interview phases for natural flow
        this.PHASES = {
            GREETING: 'greeting',
            WARMUP: 'warmup',
            CORE_QUESTIONS: 'core_questions',
            CLOSING: 'closing',
            COMPLETED: 'completed'
        };
        
        // Optimal settings based on research
        this.settings = {
            maxFollowUpsPerQuestion: 1,
            minWordCountForComplete: 15,
            transitionDelayMs: 2000,
            maxInterviewDurationMs: 45 * 60 * 1000 // 45 minutes
        };
    }
    
    /**
     * Initialize a new interview
     */
    initializeInterview(interviewId, data) {
        this.interviews.set(interviewId, {
            id: interviewId,
            candidate: data.candidate,
            role: data.role,
            questions: this.prepareQuestions(data.customQuestions, data.role),
            currentPhase: this.PHASES.GREETING,
            currentQuestionIndex: -1,
            conversationHistory: [],
            responses: [],
            startTime: new Date(),
            followUpCounts: {},
            lastInteractionTime: new Date(),
            hasGreeted: false,
            isWaitingForResponse: false
        });
    }
    
    /**
     * Prepare questions with proper structure
     */
    prepareQuestions(customQuestions, role) {
        // Always start with a warmup question
        const warmupQuestion = "To start, could you tell me a bit about yourself and what attracted you to this " + role + " opportunity?";
        
        // Core questions (custom or defaults)
        const coreQuestions = customQuestions && customQuestions.length > 0 
            ? customQuestions 
            : this.getDefaultQuestionsForRole(role);
        
        // Always end with candidate questions
        const closingQuestion = "Thank you for sharing. What questions do you have for me about the role or the company?";
        
        return [warmupQuestion, ...coreQuestions, closingQuestion];
    }
    
    /**
     * Main interaction handler - simplified and clear
     */
    async handleInteraction(interviewId, candidateMessage = null, metadata = {}) {
        const interview = this.interviews.get(interviewId);
        if (!interview) throw new Error('Interview not found');
        
        // Update interaction time
        interview.lastInteractionTime = new Date();
        
        // Log the interaction for debugging
        console.log(`[Interview ${interviewId}] Phase: ${interview.currentPhase}, Message: ${candidateMessage?.substring(0, 50)}...`);
        
        // Add candidate message to history if provided
        if (candidateMessage && candidateMessage.trim()) {
            interview.conversationHistory.push({
                role: 'candidate',
                content: candidateMessage,
                timestamp: new Date().toISOString()
            });
        }
        
        // Route to appropriate handler based on phase
        let response;
        switch (interview.currentPhase) {
            case this.PHASES.GREETING:
                response = await this.handleGreetingPhase(interview, candidateMessage);
                break;
                
            case this.PHASES.WARMUP:
                response = await this.handleWarmupPhase(interview, candidateMessage);
                break;
                
            case this.PHASES.CORE_QUESTIONS:
                response = await this.handleCoreQuestionsPhase(interview, candidateMessage);
                break;
                
            case this.PHASES.CLOSING:
                response = await this.handleClosingPhase(interview, candidateMessage);
                break;
                
            case this.PHASES.COMPLETED:
                response = {
                    type: 'completed',
                    text: 'Thank you. The interview has been completed.',
                    phase: this.PHASES.COMPLETED
                };
                break;
                
            default:
                throw new Error(`Unknown phase: ${interview.currentPhase}`);
        }
        
        // Add AI response to history
        if (response.text) {
            interview.conversationHistory.push({
                role: 'ai',
                content: response.text,
                timestamp: new Date().toISOString(),
                type: response.type
            });
        }
        
        // Update waiting state
        interview.isWaitingForResponse = response.expectingResponse || false;
        
        return response;
    }
    
    /**
     * Handle greeting phase
     */
    async handleGreetingPhase(interview, candidateMessage) {
        if (!interview.hasGreeted) {
            // Initial greeting
            interview.hasGreeted = true;
            const greeting = await this.generateGreeting(interview);
            return {
                type: 'greeting',
                text: greeting,
                phase: this.PHASES.GREETING,
                expectingResponse: true
            };
        } else {
            // Candidate acknowledged greeting, move to warmup
            interview.currentPhase = this.PHASES.WARMUP;
            interview.currentQuestionIndex = 0;
            
            // Brief acknowledgment and first question
            const transition = "Great! Let's begin. " + interview.questions[0];
            
            return {
                type: 'question',
                text: transition,
                phase: this.PHASES.WARMUP,
                questionIndex: 0,
                expectingResponse: true
            };
        }
    }
    
    /**
     * Handle warmup phase (first question)
     */
    async handleWarmupPhase(interview, candidateMessage) {
        if (!candidateMessage) {
            // Should not happen, but return the warmup question
            return {
                type: 'question',
                text: interview.questions[0],
                phase: this.PHASES.WARMUP,
                questionIndex: 0,
                expectingResponse: true
            };
        }
        
        // Analyze response
        const analysis = await this.analyzeResponse(
            interview.questions[0], 
            candidateMessage,
            'warmup'
        );
        
        // Save response
        interview.responses.push({
            questionIndex: 0,
            question: interview.questions[0],
            answer: candidateMessage,
            timestamp: new Date().toISOString(),
            analysis
        });
        
        // Move to core questions
        interview.currentPhase = this.PHASES.CORE_QUESTIONS;
        interview.currentQuestionIndex = 1;
        
        // Generate transition to first core question
        const transition = await this.generateTransition(
            candidateMessage,
            interview.questions[1],
            'warmup_to_core'
        );
        
        return {
            type: 'question',
            text: transition,
            phase: this.PHASES.CORE_QUESTIONS,
            questionIndex: 1,
            expectingResponse: true
        };
    }
    
    /**
     * Handle core questions phase
     */
    async handleCoreQuestionsPhase(interview, candidateMessage) {
        const currentIndex = interview.currentQuestionIndex;
        const currentQuestion = interview.questions[currentIndex];
        const isLastCoreQuestion = currentIndex === interview.questions.length - 2;
        
        if (!candidateMessage) {
            // Should not happen, but return current question
            return {
                type: 'question',
                text: currentQuestion,
                phase: this.PHASES.CORE_QUESTIONS,
                questionIndex: currentIndex,
                expectingResponse: true
            };
        }
        
        // Analyze response
        const analysis = await this.analyzeResponse(
            currentQuestion,
            candidateMessage,
            'core'
        );
        
        // Check if we need clarification or should accept the answer
        if (this.shouldAskForClarification(analysis, candidateMessage, interview)) {
            const clarification = await this.generateClarification(
                currentQuestion,
                candidateMessage,
                analysis
            );
            
            // Track that we asked for clarification
            if (!interview.followUpCounts[currentIndex]) {
                interview.followUpCounts[currentIndex] = 0;
            }
            interview.followUpCounts[currentIndex]++;
            
            return {
                type: 'clarification',
                text: clarification,
                phase: this.PHASES.CORE_QUESTIONS,
                questionIndex: currentIndex,
                expectingResponse: true
            };
        }
        
        // Save response
        interview.responses.push({
            questionIndex: currentIndex,
            question: currentQuestion,
            answer: candidateMessage,
            timestamp: new Date().toISOString(),
            analysis
        });
        
        // Move to next question or closing
        if (isLastCoreQuestion) {
            // Move to closing phase
            interview.currentPhase = this.PHASES.CLOSING;
            interview.currentQuestionIndex = interview.questions.length - 1;
            
            const transition = await this.generateTransition(
                candidateMessage,
                interview.questions[interview.currentQuestionIndex],
                'core_to_closing'
            );
            
            return {
                type: 'question',
                text: transition,
                phase: this.PHASES.CLOSING,
                questionIndex: interview.currentQuestionIndex,
                expectingResponse: true
            };
        } else {
            // Move to next core question
            interview.currentQuestionIndex++;
            
            const transition = await this.generateTransition(
                candidateMessage,
                interview.questions[interview.currentQuestionIndex],
                'core_to_core'
            );
            
            return {
                type: 'question',
                text: transition,
                phase: this.PHASES.CORE_QUESTIONS,
                questionIndex: interview.currentQuestionIndex,
                expectingResponse: true
            };
        }
    }
    
    /**
     * Handle closing phase
     */
    async handleClosingPhase(interview, candidateMessage) {
        if (!candidateMessage) {
            // Return closing question
            return {
                type: 'question',
                text: interview.questions[interview.questions.length - 1],
                phase: this.PHASES.CLOSING,
                questionIndex: interview.questions.length - 1,
                expectingResponse: true
            };
        }
        
        // Save final response
        interview.responses.push({
            questionIndex: interview.questions.length - 1,
            question: interview.questions[interview.questions.length - 1],
            answer: candidateMessage,
            timestamp: new Date().toISOString()
        });
        
        // Generate closing message
        const closing = await this.generateClosing(interview);
        
        // Mark as completed
        interview.currentPhase = this.PHASES.COMPLETED;
        interview.endTime = new Date();
        
        return {
            type: 'closing',
            text: closing,
            phase: this.PHASES.COMPLETED,
            expectingResponse: false
        };
    }
    
    /**
     * Generate initial greeting
     */
    async generateGreeting(interview) {
        const duration = Math.ceil(interview.questions.length * 5); // ~5 min per question
        
        const prompt = `You are a professional interviewer. Generate a warm, professional greeting for ${interview.candidate.name}.

Role: ${interview.role}
Number of questions: ${interview.questions.length}
Estimated duration: ${duration} minutes

Requirements:
- Be welcoming and professional
- Mention the role briefly
- Set expectations for duration
- Ask if they're ready to begin
- Keep it concise (2-3 sentences)`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return completion.choices[0].message.content;
    }
    
    /**
     * Analyze response quality and intent
     */
    async analyzeResponse(question, response, questionType) {
        const prompt = `Analyze this interview response for quality and completeness.

Question Type: ${questionType}
Question: "${question}"
Response: "${response}"

Provide a JSON analysis:
{
  "isComplete": boolean (true if response adequately addresses the question),
  "quality": "brief|adequate|detailed|comprehensive",
  "hasSpecificExamples": boolean,
  "missingElements": ["array of missing key points, empty if complete"],
  "wordCount": number,
  "requestedClarification": boolean (true if candidate asked for clarification),
  "requestedRepeat": boolean (true if candidate asked to repeat)
}

Be lenient - accept brief answers as complete if they address the core question.
Only mark as incomplete if critical information is missing.`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are analyzing interview responses. Be fair and reasonable.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 200
        });

        return JSON.parse(completion.choices[0].message.content);
    }
    
    /**
     * Determine if clarification is needed
     */
    shouldAskForClarification(analysis, response, interview) {
        const currentIndex = interview.currentQuestionIndex;
        
        // Never ask for clarification more than once per question
        if (interview.followUpCounts[currentIndex] >= 1) {
            return false;
        }
        
        // If they asked for clarification or repeat, always provide it
        if (analysis.requestedClarification || analysis.requestedRepeat) {
            return true;
        }
        
        // For very brief responses on core questions, ask for more detail
        if (analysis.wordCount < 10 && interview.currentPhase === this.PHASES.CORE_QUESTIONS) {
            return true;
        }
        
        // Otherwise, accept the answer
        return false;
    }
    
    /**
     * Generate clarification or follow-up
     */
    async generateClarification(question, response, analysis) {
        let prompt;
        
        if (analysis.requestedRepeat) {
            prompt = `The candidate asked to repeat the question. Acknowledge and repeat clearly:
Original question: "${question}"
Keep it natural and patient.`;
        } else if (analysis.requestedClarification) {
            prompt = `The candidate needs clarification. Rephrase this question more clearly:
Original question: "${question}"
Make it clearer while maintaining the intent.`;
        } else {
            prompt = `The candidate gave a brief response. Ask for a bit more detail:
Question: "${question}"
Their response: "${response}"
Missing elements: ${analysis.missingElements.join(', ') || 'specific examples'}

Generate a brief, encouraging follow-up to get more information.
Keep it concise and specific.`;
        }

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be encouraging and specific.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return completion.choices[0].message.content;
    }
    
    /**
     * Generate smooth transitions between questions
     */
    async generateTransition(lastAnswer, nextQuestion, transitionType) {
        const prompts = {
            warmup_to_core: `Generate a smooth transition from the warmup to the first core question.
Acknowledge their introduction briefly, then ask: "${nextQuestion}"
Keep it natural and conversational (2-3 sentences total).`,
            
            core_to_core: `Generate a brief transition to the next question.
Acknowledge their answer with a simple "Thank you" or "I see", then ask: "${nextQuestion}"
Keep it very brief (1-2 sentences total).`,
            
            core_to_closing: `Generate a transition to the closing question.
Thank them for their detailed responses, then ask: "${nextQuestion}"
Keep it warm but brief (2 sentences).`
        };

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Keep transitions brief and natural.' },
                { role: 'user', content: prompts[transitionType] }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        return completion.choices[0].message.content;
    }
    
    /**
     * Generate closing message
     */
    async generateClosing(interview) {
        const duration = Math.round((interview.endTime - interview.startTime) / 60000);
        
        const prompt = `Generate a professional closing for the interview.

Candidate: ${interview.candidate.name}
Role: ${interview.role}
Duration: ${duration} minutes

Requirements:
- Thank them for their time
- Mention next steps briefly
- End on a positive note
- Keep it concise (2-3 sentences)`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer ending the interview.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return completion.choices[0].message.content;
    }
    
    /**
     * Get default questions based on role
     */
    getDefaultQuestionsForRole(role) {
        const questionSets = {
            'Software Engineer': [
                'Can you walk me through a recent technical challenge you faced and how you solved it?',
                'How do you ensure code quality in your projects?',
                'Tell me about a time you had to work with a difficult team member.',
                'How do you stay updated with new technologies?'
            ],
            'Product Manager': [
                'How do you prioritize features when everything seems important?',
                'Tell me about a product you successfully launched.',
                'How do you handle disagreements with stakeholders?',
                'What metrics do you use to measure product success?'
            ],
            'default': [
                'What accomplishment are you most proud of in your career?',
                'How do you handle pressure and tight deadlines?',
                'Describe a time when you had to learn something new quickly.',
                'What interests you most about working here?'
            ]
        };
        
        return questionSets[role] || questionSets.default;
    }
    
    /**
     * Get interview summary for evaluation
     */
    getInterviewSummary(interviewId) {
        const interview = this.interviews.get(interviewId);
        if (!interview) return null;
        
        return {
            id: interviewId,
            candidate: interview.candidate,
            role: interview.role,
            duration: interview.endTime ? Math.round((interview.endTime - interview.startTime) / 60000) : 0,
            responses: interview.responses,
            questionCount: interview.questions.length,
            completionRate: (interview.responses.length / interview.questions.length) * 100,
            conversationHistory: interview.conversationHistory
        };
    }
}

module.exports = ProfessionalInterviewOrchestrator;