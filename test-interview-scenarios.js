#!/usr/bin/env node

/**
 * Test various interview scenarios with the new orchestrator
 */

const OpenAI = require('openai');
const ProfessionalInterviewOrchestrator = require('./interview-orchestrator-v2');

// Test scenarios
async function runScenarios() {
    console.log('\n🧪 Testing Interview Scenarios\n');
    
    const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY || 'sk-test' 
    });
    const orchestrator = new ProfessionalInterviewOrchestrator(openai);
    
    // Scenario 1: Normal Flow
    console.log('📋 Scenario 1: Normal Interview Flow');
    console.log('=====================================\n');
    
    const interviewId = 'test-normal-flow';
    orchestrator.initializeInterview(interviewId, {
        candidate: { name: 'Alice Johnson', email: 'alice@example.com' },
        role: 'Software Engineer',
        customQuestions: [
            'Describe your experience with microservices.',
            'How do you handle technical debt?'
        ]
    });
    
    // Greeting
    let response = await orchestrator.handleInteraction(interviewId);
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Phase: ${response.phase}, Expecting Response: ${response.expectingResponse}\n`);
    
    // Candidate ready
    console.log('Candidate: "Yes, I\'m ready to begin."');
    response = await orchestrator.handleInteraction(interviewId, "Yes, I'm ready to begin.");
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Phase: ${response.phase}, Question Index: ${response.questionIndex}\n`);
    
    // Answer warmup
    console.log('Candidate: "I have 10 years of experience in software development..."');
    response = await orchestrator.handleInteraction(interviewId, 
        "I have 10 years of experience in software development, specializing in backend systems. I'm particularly excited about this role because of your company's focus on scalable architecture."
    );
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Phase: ${response.phase}\n`);
    
    // Answer first core question
    console.log('Candidate: "I\'ve worked extensively with microservices..."');
    response = await orchestrator.handleInteraction(interviewId,
        "I've worked extensively with microservices at my current company. We migrated from a monolithic architecture to microservices, which improved our deployment speed by 70%."
    );
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Phase: ${response.phase}\n`);
    
    console.log('\n📋 Scenario 2: Candidate Asks to Repeat');
    console.log('======================================\n');
    
    // Test repeat request
    console.log('Candidate: "Sorry, could you repeat that question?"');
    response = await orchestrator.handleInteraction(interviewId, "Sorry, could you repeat that question?");
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Should repeat the question about technical debt\n`);
    
    console.log('\n📋 Scenario 3: Brief Answer Handling');
    console.log('====================================\n');
    
    // Give brief answer
    console.log('Candidate: "We refactor regularly."');
    response = await orchestrator.handleInteraction(interviewId, "We refactor regularly.");
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Should ask for more detail (follow-up)\n`);
    
    // Complete the answer
    console.log('Candidate: "We allocate 20% of each sprint to address technical debt..."');
    response = await orchestrator.handleInteraction(interviewId,
        "We allocate 20% of each sprint to address technical debt. We use SonarQube to track code quality metrics and prioritize based on impact."
    );
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Should move to closing phase\n`);
    
    // Answer closing question
    console.log('Candidate: "What is the team structure like?"');
    response = await orchestrator.handleInteraction(interviewId, "What is the team structure like?");
    console.log(`AI (${response.type}): ${response.text}`);
    console.log(`Phase: ${response.phase} - Should be completed\n`);
    
    // Get summary
    const summary = orchestrator.getInterviewSummary(interviewId);
    console.log('\n📊 Interview Summary:');
    console.log(`Duration: ${summary.duration} minutes`);
    console.log(`Questions: ${summary.responses.length}/${summary.questionCount}`);
    console.log(`Completion Rate: ${summary.completionRate}%`);
    
    console.log('\n✅ Test scenarios completed!');
}

// Run tests
runScenarios().catch(console.error);