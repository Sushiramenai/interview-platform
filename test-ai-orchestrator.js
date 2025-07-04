#!/usr/bin/env node

/**
 * Test script for the new AI Interview Orchestrator
 * This demonstrates various interview scenarios and response handling
 */

const OpenAI = require('openai');
const AIInterviewOrchestrator = require('./server-new-ai');

// Mock OpenAI API key for testing (replace with actual key)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-api-key-here';

async function testOrchestrator() {
    console.log('\n🧪 Testing AI Interview Orchestrator\n');
    
    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    // Create orchestrator instance
    const orchestrator = new AIInterviewOrchestrator(openai);
    
    // Test Interview Data
    const testInterviewId = 'test-interview-123';
    const interviewData = {
        candidate: {
            name: 'John Doe',
            email: 'john@example.com'
        },
        role: 'Software Engineer',
        customQuestions: [
            'Tell me about your experience with JavaScript and Node.js.',
            'Describe a challenging bug you solved recently.',
            'How do you approach code reviews?'
        ]
    };
    
    console.log('1️⃣ Initializing interview...');
    orchestrator.initializeInterview(testInterviewId, interviewData);
    
    // Test 1: Get greeting
    console.log('\n2️⃣ Testing greeting generation...');
    const greeting = await orchestrator.processInteraction(testInterviewId, null, 'greeting');
    console.log('Greeting:', greeting.text);
    console.log('Action:', greeting.action);
    
    // Test 2: Move to first question
    console.log('\n3️⃣ Testing first question...');
    const firstQuestion = await orchestrator.processInteraction(testInterviewId, 'ready', 'ready');
    console.log('First Question:', firstQuestion.text);
    console.log('Question Index:', firstQuestion.questionIndex);
    
    // Test 3: Various candidate responses
    console.log('\n4️⃣ Testing various response scenarios...\n');
    
    // Test 3a: Normal response
    console.log('Scenario A: Normal response');
    const normalResponse = await orchestrator.processInteraction(
        testInterviewId, 
        'I have 5 years of experience with JavaScript and 3 years with Node.js. I\'ve built several production APIs.',
        'response'
    );
    console.log('AI Response:', normalResponse.text);
    console.log('Type:', normalResponse.type);
    
    // Test 3b: Request to repeat
    console.log('\nScenario B: Candidate asks to repeat');
    const repeatResponse = await orchestrator.processInteraction(
        testInterviewId,
        'Sorry, can you repeat the question?',
        'response'
    );
    console.log('AI Response:', repeatResponse.text);
    console.log('Type:', repeatResponse.type);
    
    // Test 3c: Vague response that needs follow-up
    console.log('\nScenario C: Vague response needing follow-up');
    const vagueResponse = await orchestrator.processInteraction(
        testInterviewId,
        'I guess I have some experience with that.',
        'response'
    );
    console.log('AI Response:', vagueResponse.text);
    console.log('Type:', vagueResponse.type);
    
    // Test 3d: Request for clarification
    console.log('\nScenario D: Candidate asks for clarification');
    const clarifyResponse = await orchestrator.processInteraction(
        testInterviewId,
        'What exactly do you mean by code reviews? Are you asking about my process or tools?',
        'response'
    );
    console.log('AI Response:', clarifyResponse.text);
    console.log('Type:', clarifyResponse.type);
    
    // Test 3e: Comprehensive answer
    console.log('\nScenario E: Comprehensive answer');
    const comprehensiveResponse = await orchestrator.processInteraction(
        testInterviewId,
        'In my current role, I participate in code reviews daily. I focus on three main aspects: code correctness, readability, and performance. I always start by understanding the context of the change, then review the implementation details. I provide constructive feedback and often suggest alternative approaches when beneficial. I also use automated tools like ESLint and SonarQube to catch common issues before human review.',
        'response'
    );
    console.log('AI Response:', comprehensiveResponse.text);
    console.log('Type:', comprehensiveResponse.type);
    console.log('Action:', comprehensiveResponse.action);
    
    // Test 4: Interview evaluation
    console.log('\n5️⃣ Testing interview evaluation...');
    const interview = orchestrator.getInterview(testInterviewId);
    const evaluation = await orchestrator.evaluateInterview(interview);
    console.log('\nEvaluation Summary:');
    console.log('Duration:', evaluation.duration, 'minutes');
    console.log('Completion Rate:', evaluation.completionRate + '%');
    console.log('\nDetailed Evaluation:');
    console.log(evaluation.evaluation.substring(0, 500) + '...');
    
    console.log('\n✅ All tests completed!\n');
}

// Run tests
testOrchestrator().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});

// Example output format
console.log('\n📝 Example Usage in Production:\n');
console.log(`
// In your socket handler:
const orchestrator = getAIOrchestrator();

// When candidate responds:
socket.on('candidate-response', async (data) => {
    const response = await orchestrator.processInteraction(
        socket.interviewId, 
        data.text, 
        'response'
    );
    
    // Handle different response types:
    switch(response.type) {
        case 'followup':
            // AI wants more information
            socket.emit('ai-followup', { text: response.text, audio: generateAudio(response.text) });
            break;
            
        case 'clarification':
        case 'repeat':
            // AI is clarifying or repeating
            socket.emit('ai-followup', { text: response.text, audio: generateAudio(response.text), isSpecialResponse: true });
            break;
            
        default:
            // Normal acknowledgment and progression
            socket.emit('ai-acknowledgment', { 
                text: response.text, 
                audio: generateAudio(response.text),
                moveToNext: response.action !== 'wait_for_response'
            });
    }
});
`);