#!/usr/bin/env node

/**
 * Debug script to test the interview flow step by step
 */

const io = require('socket.io-client');

async function debugInterview() {
    console.log('\n🔍 Interview System Debug Test\n');
    
    // Connect to local server
    const socket = io('http://localhost:3000', {
        transports: ['websocket', 'polling']
    });
    
    // Add all event listeners
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        console.log('Socket ID:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
    });
    
    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });
    
    socket.on('interview-info', (data) => {
        console.log('📋 Interview info received:', data);
    });
    
    socket.on('ai-speaks', (data) => {
        console.log('\n🤖 AI Speaks:');
        console.log('Type:', data.type);
        console.log('Phase:', data.phase);
        console.log('Text:', data.text);
        console.log('Has Audio:', !!data.audio);
        console.log('Expecting Response:', data.expectingResponse);
        
        if (data.type === 'greeting' && data.expectingResponse) {
            // Simulate candidate ready response after 3 seconds
            setTimeout(() => {
                console.log('\n👤 Candidate: "Yes, I\'m ready to begin."');
                socket.emit('candidate-response', {
                    text: "Yes, I'm ready to begin."
                });
            }, 3000);
        }
    });
    
    // Simulate joining an interview
    // You'll need to replace this with an actual interview ID
    const testInterviewId = process.argv[2];
    
    if (!testInterviewId) {
        console.error('❌ Please provide an interview ID as argument');
        console.log('Usage: node debug-interview.js <interview-id>');
        process.exit(1);
    }
    
    console.log(`\n🎯 Joining interview: ${testInterviewId}`);
    
    // Wait for connection then join
    socket.on('connect', () => {
        setTimeout(() => {
            socket.emit('join-interview', {
                interviewId: testInterviewId
            });
        }, 1000);
    });
    
    // Keep the script running
    process.on('SIGINT', () => {
        console.log('\n\n👋 Closing debug session');
        socket.disconnect();
        process.exit(0);
    });
}

// Run the debug test
debugInterview();

console.log('\n💡 Debug session started. Press Ctrl+C to exit.\n');