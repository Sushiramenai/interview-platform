#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Auto-start script that handles everything
async function autoStart() {
    console.log('🚀 Senbird Interview System - Auto Setup\n');
    
    // Check if we're on Replit
    const isReplit = process.env.REPL_SLUG && process.env.REPL_OWNER;
    
    // Check if .env exists
    const envPath = path.join(__dirname, '.env');
    let envExists = false;
    
    try {
        await fs.access(envPath);
        envExists = true;
    } catch (e) {
        // .env doesn't exist
    }
    
    if (!envExists) {
        console.log('📝 First time setup detected!\n');
        
        // Create .env with Replit secrets or empty values
        let envContent = '# AI Interview Platform Configuration\n\n';
        
        // Check for Replit secrets
        if (isReplit) {
            console.log('🔍 Checking for Replit secrets...\n');
            
            const claudeKey = process.env.CLAUDE_API_KEY || '';
            const elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
            
            if (claudeKey || elevenLabsKey) {
                console.log('✅ Found API keys in Replit secrets!\n');
                envContent += `CLAUDE_API_KEY=${claudeKey}\n`;
                envContent += `ELEVENLABS_API_KEY=${elevenLabsKey}\n`;
            } else {
                console.log('⚠️  No API keys found in Replit secrets.\n');
                console.log('To add them:');
                console.log('1. Click the 🔒 Secrets button in Replit');
                console.log('2. Add CLAUDE_API_KEY');
                console.log('3. Add ELEVENLABS_API_KEY (optional)\n');
                
                // Use empty values for now
                envContent += 'CLAUDE_API_KEY=\n';
                envContent += 'ELEVENLABS_API_KEY=\n';
            }
        } else {
            // Not on Replit, use empty values
            envContent += 'CLAUDE_API_KEY=\n';
            envContent += 'ELEVENLABS_API_KEY=\n';
        }
        
        envContent += 'PORT=3000\n';
        
        // Create .env file
        await fs.writeFile(envPath, envContent);
        console.log('✅ Created .env file\n');
    }
    
    // Check if node_modules exists
    try {
        await fs.access(path.join(__dirname, 'node_modules'));
    } catch (e) {
        console.log('📦 Installing dependencies...\n');
        await runCommand('npm', ['install']);
    }
    
    // Create required directories
    const dirs = [
        'views',
        'public/js',
        'public/css',
        'data/recordings',
        'data/results'
    ];
    
    for (const dir of dirs) {
        await fs.mkdir(path.join(__dirname, dir), { recursive: true });
    }
    
    // Load environment variables
    require('dotenv').config();
    
    // Check if API keys are configured
    const hasClaudeKey = !!process.env.CLAUDE_API_KEY;
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    
    console.log('🔑 API Key Status:');
    console.log(`   Claude API: ${hasClaudeKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   ElevenLabs: ${hasElevenLabsKey ? '✅ Configured' : '⚠️  Missing (voice disabled)'}\n`);
    
    if (!hasClaudeKey && isReplit) {
        console.log('⚠️  IMPORTANT: Claude API key is required!\n');
        console.log('To add it:');
        console.log('1. Get your key from https://console.anthropic.com/');
        console.log('2. Click the 🔒 Secrets button in Replit');
        console.log('3. Add a secret named CLAUDE_API_KEY');
        console.log('4. Paste your API key as the value');
        console.log('5. Stop and Run again\n');
    }
    
    // Start the server
    console.log('🚀 Starting Senbird Interview System...\n');
    
    // Use spawn to run server.js
    const server = spawn('node', ['server.js'], {
        stdio: 'inherit',
        env: process.env
    });
    
    server.on('error', (err) => {
        console.error('Failed to start server:', err);
    });
    
    server.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Server exited with code ${code}`);
        }
    });
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { stdio: 'inherit' });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} exited with code ${code}`));
            }
        });
    });
}

// Run auto-start
autoStart().catch(console.error);