#!/usr/bin/env node

/**
 * Simple test to demonstrate proper interview flow
 */

const OpenAI = require('openai');
const AIInterviewOrchestrator = require('./server-new-ai');

async function simulateInterview() {
    console.log('\n🎭 Simulating Interview Flow\n');
    
    // Initialize
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-test' });
    const orchestrator = new AIInterviewOrchestrator(openai);
    const interviewId = 'test-123';
    
    // Setup interview
    orchestrator.initializeInterview(interviewId, {
        candidate: { name: 'Jane Smith', email: 'jane@example.com' },
        role: 'Software Engineer',
        customQuestions: [
            'Tell me about a challenging project you worked on.',
            'How do you handle tight deadlines?',
            'What interests you about our company?'
        ]
    });
    
    console.log('=== INTERVIEW FLOW ===\n');
    
    // 1. Greeting
    console.log('1. GREETING PHASE');
    let response = await orchestrator.processInteraction(interviewId, null, 'greeting');
    console.log(`AI: ${response.text}`);
    console.log(`[State: ${response.action}]\n`);
    
    // 2. Candidate says ready
    console.log('2. CANDIDATE READY');
    console.log('Candidate: "Yes, I\'m ready to begin."');
    response = await orchestrator.processInteraction(interviewId, "Yes, I'm ready to begin.", 'response');
    console.log(`AI: ${response.text}`);
    console.log(`[Type: ${response.type}, Action: ${response.action}]\n`);
    
    // 3. Answer first question
    console.log('3. FIRST ANSWER');
    console.log('Candidate: "I worked on a distributed system that handled millions of transactions..."');
    response = await orchestrator.processInteraction(interviewId, 
        "I worked on a distributed system that handled millions of transactions per day. The challenge was ensuring data consistency across multiple regions while maintaining low latency.",
        'response'
    );
    console.log(`AI: ${response.text}`);
    console.log(`[Type: ${response.type}, Action: ${response.action}]\n`);
    
    // 4. Ready for next question (if transition happened)
    if (response.action === 'move_to_next') {
        console.log('4. NEXT QUESTION');
        response = await orchestrator.processInteraction(interviewId, 'ready', 'ready');
        console.log(`AI: ${response.text}`);
        console.log(`[Type: ${response.type}, Action: ${response.action}]\n`);
    }
    
    // 5. Test repeat request
    console.log('5. REPEAT REQUEST');
    console.log('Candidate: "Sorry, can you repeat that?"');
    response = await orchestrator.processInteraction(interviewId, "Sorry, can you repeat that?", 'response');
    console.log(`AI: ${response.text}`);
    console.log(`[Type: ${response.type}, Action: ${response.action}]\n`);
    
    // Get interview state
    const interview = orchestrator.getInterview(interviewId);
    console.log('=== INTERVIEW STATE ===');
    console.log(`Current Question Index: ${interview.currentQuestionIndex}`);
    console.log(`State: ${interview.state}`);
    console.log(`Responses Collected: ${interview.responses.length}`);
    console.log(`Conversation History Length: ${interview.conversationHistory.length}`);
}

simulateInterview().catch(console.error);