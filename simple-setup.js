#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🎙️  Senbird Interview Platform Setup               ║
║                                                           ║
║   AI-powered interviews with OpenAI & ElevenLabs         ║
╚═══════════════════════════════════════════════════════════╝
`);

async function setup() {
    try {
        console.log('This setup will help you get started in just 2 minutes!\n');
        
        // Step 1: Install dependencies
        console.log('📦 Step 1: Installing dependencies...');
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed');
        
        // Step 2: Create directories
        console.log('\n📁 Step 2: Creating directories...');
        await fs.mkdir(path.join(__dirname, 'data/recordings'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'data/results'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'data/templates'), { recursive: true });
        console.log('✅ Directories created');
        
        // Step 3: Configure API keys
        console.log('\n🔑 Step 3: API Configuration...\n');
        
        console.log('You have two options for API configuration:\n');
        console.log('Option A: Use the Settings UI (Recommended)');
        console.log('  - Start the server and click the settings icon');
        console.log('  - Enter your API keys in the UI\n');
        
        console.log('Option B: Enter them now\n');
        
        const useEnv = await question('Would you like to enter API keys now? (y/n): ');
        
        if (useEnv.toLowerCase() === 'y') {
            console.log('\n1. OpenAI API Key (Required)');
            console.log('   Get yours at: https://platform.openai.com/');
            console.log('   Price: ~$0.30-0.50 per interview\n');
            
            const openaiKey = await question('Enter your OpenAI API key: ');
            
            console.log('\n2. ElevenLabs API Key (Optional but recommended)');
            console.log('   Get yours at: https://elevenlabs.io/');
            console.log('   Price: Free tier includes 10,000 characters/month\n');
            
            const elevenLabsKey = await question('Enter your ElevenLabs API key (or press Enter to skip): ');
            
            // Save to config.json
            const config = {
                openai_api_key: openaiKey.trim(),
                elevenlabs_api_key: elevenLabsKey.trim(),
                elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL'
            };
            
            await fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
            console.log('\n✅ Configuration saved');
        }
        
        // Step 4: Final instructions
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  ✅ Setup Complete!                        ║
╚═══════════════════════════════════════════════════════════╝

🚀 To start the platform:

   npm start

📱 Then open your browser to:

   http://localhost:3000

🎯 Quick Start Guide:

   1. Click the settings icon (⚙️) to configure API keys
   2. Click "Manage Templates" to create position templates
   3. Select a template and enter candidate details
   4. Choose an AI voice
   5. Create and share the interview link
   6. View results when complete

💡 Features:

   ✓ OpenAI GPT-4 powered interviews
   ✓ Natural voice synthesis with ElevenLabs
   ✓ Interview templates for different positions
   ✓ Automatic video/audio recording
   ✓ Private AI evaluations (HR only)
   ✓ In-app API configuration

📧 Need help? Check the README or visit the documentation.

Happy interviewing! 🎉
`);
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\nPlease check the error and try again.');
    } finally {
        rl.close();
    }
}

// Run setup
setup();