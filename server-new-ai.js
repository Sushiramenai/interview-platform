// Enhanced AI Interview Orchestration System
// This is a complete rebuild of the AI logic for better conversation flow

class AIInterviewOrchestrator {
    constructor(openai) {
        this.openai = openai;
        this.interviews = new Map();
    }

    // Initialize a new interview session
    initializeInterview(interviewId, interviewData) {
        this.interviews.set(interviewId, {
            id: interviewId,
            candidate: interviewData.candidate,
            role: interviewData.role,
            questions: interviewData.customQuestions || this.getDefaultQuestions(interviewData.role),
            currentQuestionIndex: -1,
            conversationHistory: [],
            state: 'greeting',
            startTime: new Date(),
            responses: []
        });
    }

    // Get the current interview state
    getInterview(interviewId) {
        return this.interviews.get(interviewId);
    }

    // Main method to handle any interaction
    async processInteraction(interviewId, candidateText = null, interactionType = 'response') {
        const interview = this.getInterview(interviewId);
        if (!interview) throw new Error('Interview not found');

        // Add candidate response to history if provided and not a system interaction
        if (candidateText && interactionType === 'response') {
            interview.conversationHistory.push({
                role: 'candidate',
                content: candidateText,
                timestamp: new Date().toISOString()
            });
        }

        // Determine next action based on current state and interaction
        let response;
        switch (interview.state) {
            case 'greeting':
                response = await this.generateGreeting(interview);
                interview.state = 'waiting_for_ready';
                break;

            case 'waiting_for_ready':
                // When candidate is ready, move to first question
                response = await this.moveToFirstQuestion(interview);
                interview.state = 'asking_question';
                break;

            case 'asking_question':
                // Special handling for system 'ready' signals (moving between questions)
                if (interactionType === 'ready') {
                    // This means we're ready for the next question
                    if (interview.currentQuestionIndex < interview.questions.length - 1) {
                        interview.currentQuestionIndex++;
                        response = await this.askQuestion(interview);
                    } else {
                        response = await this.concludeInterview(interview);
                        interview.state = 'completed';
                    }
                } else if (candidateText) {
                    // Analyze the candidate's response and determine next action
                    const analysis = await this.analyzeResponse(interview, candidateText);
                    
                    if (analysis.needsClarification) {
                        response = await this.generateClarification(interview, analysis);
                        // Stay in same state to get clarification
                    } else if (analysis.requestRepeat) {
                        response = await this.repeatQuestion(interview);
                        // Stay in same state
                    } else if (analysis.answerComplete) {
                        // Save the response
                        interview.responses.push({
                            questionIndex: interview.currentQuestionIndex,
                            question: interview.questions[interview.currentQuestionIndex],
                            answer: candidateText,
                            timestamp: new Date().toISOString()
                        });

                        // Move to next question or end
                        if (interview.currentQuestionIndex < interview.questions.length - 1) {
                            response = await this.moveToNextQuestion(interview);
                        } else {
                            response = await this.concludeInterview(interview);
                            interview.state = 'completed';
                        }
                    } else {
                        // Generate a follow-up to get more information
                        response = await this.generateFollowUp(interview, analysis);
                        // Stay in same state
                    }
                } else {
                    // No text provided, this shouldn't happen
                    console.error('No candidate text provided in asking_question state');
                    response = await this.repeatQuestion(interview);
                }
                break;

            case 'completed':
                response = {
                    type: 'completed',
                    text: "The interview has already been completed. Thank you!",
                    action: 'end'
                };
                break;

            default:
                throw new Error(`Unknown interview state: ${interview.state}`);
        }

        // Add AI response to history
        interview.conversationHistory.push({
            role: 'ai',
            content: response.text,
            timestamp: new Date().toISOString(),
            metadata: response
        });

        return response;
    }

    // Generate initial greeting
    async generateGreeting(interview) {
        const prompt = `You are a professional interviewer conducting a ${interview.role} interview.
Generate a warm, professional greeting for ${interview.candidate.name}.

Requirements:
- Be welcoming but professional
- Briefly mention the role they're interviewing for
- Set expectations (number of questions, approximate duration)
- Ask if they're ready to begin
- Keep it concise (2-3 sentences)

Number of questions: ${interview.questions.length}`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be warm but professional.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'greeting',
            text: completion.choices[0].message.content,
            action: 'wait_for_ready'
        };
    }

    // Move to first question
    async moveToFirstQuestion(interview) {
        interview.currentQuestionIndex = 0;
        const question = interview.questions[0];

        const prompt = `You are a professional interviewer. The candidate has indicated they're ready to begin.
Acknowledge this and smoothly transition to asking the first question.

First question to ask: "${question}"

Requirements:
- Brief acknowledgment (e.g., "Great, let's begin")
- Ask the question naturally
- Do not add extra commentary or explanation`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be concise and natural.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'question',
            text: completion.choices[0].message.content,
            questionIndex: 0,
            action: 'wait_for_response'
        };
    }

    // Analyze candidate's response
    async analyzeResponse(interview, response) {
        const currentQuestion = interview.questions[interview.currentQuestionIndex];
        const conversationContext = this.getRecentContext(interview, 5);

        const prompt = `Analyze this interview response and determine the appropriate next action.

Current Question: "${currentQuestion}"
Candidate's Response: "${response}"

Recent Conversation Context:
${conversationContext}

Analyze and return a JSON object with:
{
  "intent": "normal|repeat|clarify|skip|offtopic",
  "answerComplete": boolean,
  "answerQuality": "none|partial|complete|comprehensive",
  "needsClarification": boolean,
  "clarificationReason": "string or null",
  "keyPointsMissing": ["array of missing points or empty"],
  "requestRepeat": boolean
}

Intent meanings:
- normal: Standard answer to the question
- repeat: Candidate asks to repeat/rephrase the question (e.g., "can you repeat that?", "what was the question?")
- clarify: Candidate asks for clarification (e.g., "what do you mean by...?", "can you clarify?")
- skip: Candidate wants to skip (e.g., "I don't know", "pass", "skip")
- offtopic: Response doesn't address the question

IMPORTANT:
- If the response is a substantive answer (even if brief), mark answerComplete as true
- Only mark requestRepeat as true if they explicitly ask to repeat
- Consider any response over 20 words that addresses the topic as answerComplete
- "I don't know" or "I haven't experienced that" should still be marked as answerComplete (they answered)

Consider:
- Does the response actually answer the question asked?
- Is it complete enough to move on?
- Are there critical details missing?
- Is the candidate asking for something specific?`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are analyzing interview responses. Be accurate and consider context. Err on the side of marking answers as complete unless they explicitly ask for clarification or repetition.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 200
        });

        return JSON.parse(completion.choices[0].message.content);
    }

    // Generate clarification request
    async generateClarification(interview, analysis) {
        const currentQuestion = interview.questions[interview.currentQuestionIndex];
        
        const prompt = `You are a professional interviewer. The candidate has asked for clarification on the question.

Original Question: "${currentQuestion}"
Reason for clarification: ${analysis.clarificationReason || 'Candidate requested clarification'}

Rephrase or clarify the question in a different way while maintaining its intent.
Be helpful and professional. Keep it concise.`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be helpful and clear.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'clarification',
            text: completion.choices[0].message.content,
            action: 'wait_for_response'
        };
    }

    // Repeat the current question
    async repeatQuestion(interview) {
        const currentQuestion = interview.questions[interview.currentQuestionIndex];
        
        const prompt = `You are a professional interviewer. The candidate has asked you to repeat the question.

Question to repeat: "${currentQuestion}"

Acknowledge their request briefly and repeat the question clearly.
Example: "Of course, let me repeat that. [question]"`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be clear and patient.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'repeat',
            text: completion.choices[0].message.content,
            action: 'wait_for_response'
        };
    }

    // Generate follow-up question
    async generateFollowUp(interview, analysis) {
        const currentQuestion = interview.questions[interview.currentQuestionIndex];
        const lastResponse = interview.conversationHistory[interview.conversationHistory.length - 2].content;
        
        const prompt = `You are a professional interviewer conducting a follow-up.

Original Question: "${currentQuestion}"
Candidate's Response: "${lastResponse}"
Missing Points: ${analysis.keyPointsMissing.join(', ') || 'General elaboration needed'}

Generate a natural follow-up question to get more specific information.
Requirements:
- Reference what they said to show you're listening
- Ask for specific elaboration on missing points
- Keep it concise and focused
- Be encouraging but professional`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Generate focused follow-up questions.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'followup',
            text: completion.choices[0].message.content,
            action: 'wait_for_response'
        };
    }

    // Move to next question
    async moveToNextQuestion(interview) {
        const lastAnswer = interview.responses[interview.responses.length - 1].answer;
        interview.currentQuestionIndex++;
        const nextQuestion = interview.questions[interview.currentQuestionIndex];
        
        const prompt = `You are a professional interviewer moving to the next question.

The candidate just answered: "${lastAnswer}"
Next question to ask: "${nextQuestion}"

Requirements:
- Briefly acknowledge their answer (e.g., "Thank you for sharing that")
- Smoothly transition to the next question
- Keep the transition natural and conversational
- Do not comment on the quality of their answer
- Keep it concise (2-3 sentences total)`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Keep transitions smooth and natural.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'transition',
            text: completion.choices[0].message.content,
            questionIndex: interview.currentQuestionIndex,
            action: 'move_to_next'
        };
    }

    // Ask a question (used when ready-for-question is called)
    async askQuestion(interview) {
        const question = interview.questions[interview.currentQuestionIndex];
        
        // For questions after the first, just ask the question directly
        // The transition/acknowledgment already happened
        return {
            type: 'question',
            text: question,
            questionIndex: interview.currentQuestionIndex,
            action: 'wait_for_response'
        };
    }

    // Conclude the interview
    async concludeInterview(interview) {
        const prompt = `You are a professional interviewer concluding the interview.

The candidate has completed all ${interview.questions.length} questions.

Generate a professional closing that:
- Thanks them for their time
- Mentions next steps briefly
- Ends on a positive note
- Keeps it concise (2-3 sentences)`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional interviewer. Be warm and professional.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return {
            type: 'conclusion',
            text: completion.choices[0].message.content,
            action: 'end_interview'
        };
    }

    // Get recent conversation context
    getRecentContext(interview, maxEntries = 5) {
        const recent = interview.conversationHistory.slice(-maxEntries);
        return recent.map(entry => 
            `${entry.role.toUpperCase()}: ${entry.content}`
        ).join('\n');
    }

    // Get default questions based on role
    getDefaultQuestions(role) {
        const questionSets = {
            'Software Engineer': [
                'Tell me about your experience with software development.',
                'Describe a challenging technical problem you solved recently.',
                'How do you ensure code quality in your projects?',
                'Tell me about a time you had to learn a new technology quickly.',
                'How do you handle disagreements with team members about technical decisions?'
            ],
            'Product Manager': [
                'How do you prioritize features when everything seems important?',
                'Tell me about a product you successfully launched.',
                'How do you gather and incorporate user feedback?',
                'Describe a time when you had to say no to stakeholders.',
                'How do you measure the success of a product?'
            ],
            'Data Scientist': [
                'Walk me through a data science project you\'re proud of.',
                'How do you handle missing or messy data?',
                'Explain a complex analysis to someone without a technical background.',
                'How do you determine which model to use for a problem?',
                'Tell me about a time your analysis led to a business decision.'
            ]
        };

        return questionSets[role] || [
            'Tell me about yourself and your relevant experience.',
            'Why are you interested in this role?',
            'Describe a challenging situation you faced and how you handled it.',
            'What are your greatest strengths?',
            'Where do you see yourself in five years?'
        ];
    }

    // Evaluate the complete interview
    async evaluateInterview(interview) {
        const responses = interview.responses.map((r, i) => 
            `Question ${i + 1}: ${r.question}\nAnswer: ${r.answer}\n`
        ).join('\n');

        const prompt = `Evaluate this job interview for the ${interview.role} position.

Candidate: ${interview.candidate.name}
Duration: ${Math.round((new Date() - interview.startTime) / 60000)} minutes

Interview Transcript:
${responses}

Provide a comprehensive evaluation with:
1. Overall assessment (1-10 score)
2. Key strengths demonstrated
3. Areas for improvement
4. Communication skills assessment
5. Technical/role-specific competency
6. Cultural fit indicators
7. Recommendation (strong yes/yes/maybe/no)

Be specific and reference actual answers from the interview.`;

        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: 'You are an experienced interviewer providing detailed candidate evaluation.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        return {
            evaluation: completion.choices[0].message.content,
            responses: interview.responses,
            duration: Math.round((new Date() - interview.startTime) / 60000),
            completionRate: (interview.responses.length / interview.questions.length) * 100
        };
    }
}

module.exports = AIInterviewOrchestrator;