#\!/usr/bin/env node

const ConfigManager = require('./src/utils/config_manager');
const readline = require('readline');
const fs = require('fs').promises;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupApiKeys() {
    console.log('🔧 API Key Setup Tool\n');
    console.log('This tool will help you configure API keys for the interview platform.\n');
    
    const configManager = new ConfigManager();
    await configManager.initialize();
    
    try {
        // Claude API Key
        console.log('1️⃣ Claude API Key (required)');
        console.log('   Get your key from: https://console.anthropic.com/');
        const claudeKey = await question('   Enter your Claude API key (or press Enter to skip): ');
        
        if (claudeKey.trim()) {
            await configManager.setApiKey('CLAUDE_API_KEY', claudeKey.trim());
            console.log('   ✅ Claude API key saved\n');
        } else {
            console.log('   ⏭️  Skipped\n');
        }
        
        // ElevenLabs API Key
        console.log('2️⃣ ElevenLabs API Key (required for voice)');
        console.log('   Get your key from: https://elevenlabs.io/');
        const elevenLabsKey = await question('   Enter your ElevenLabs API key (or press Enter to skip): ');
        
        if (elevenLabsKey.trim()) {
            await configManager.setApiKey('ELEVENLABS_API_KEY', elevenLabsKey.trim());
            console.log('   ✅ ElevenLabs API key saved\n');
        } else {
            console.log('   ⏭️  Skipped\n');
        }
        
        // Google Service Account
        console.log('3️⃣ Google Service Account JSON (optional, for Google Meet)');
        console.log('   Instructions:');
        console.log('   1. Go to Google Cloud Console');
        console.log('   2. Create a service account with Calendar API access');
        console.log('   3. Download the JSON credentials file');
        console.log('   4. Copy the entire JSON content');
        
        const useGoogleCreds = await question('   Do you have Google credentials JSON? (y/N): ');
        
        if (useGoogleCreds.toLowerCase() === 'y') {
            console.log('   Paste your Google Service Account JSON (press Enter twice when done):');
            
            let jsonLines = [];
            let line;
            while ((line = await question('')) \!== '') {
                jsonLines.push(line);
            }
            
            const googleJson = jsonLines.join('\n');
            
            try {
                // Validate JSON
                JSON.parse(googleJson);
                await configManager.setApiKey('GOOGLE_CREDENTIALS', googleJson);
                console.log('   ✅ Google credentials saved\n');
            } catch (error) {
                console.log('   ❌ Invalid JSON format\n');
            }
        } else {
            console.log('   ⏭️  Skipped (interviews will work without Google Meet integration)\n');
        }
        
        // Verify configuration
        console.log('📋 Configuration Summary:');
        const apiKeys = await configManager.getApiKeys();
        console.log('   Claude API:', apiKeys.CLAUDE_API_KEY ? '✅ Configured' : '❌ Not configured');
        console.log('   ElevenLabs:', apiKeys.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Not configured');
        console.log('   Google Meet:', apiKeys.GOOGLE_CREDENTIALS ? '✅ Configured' : '❌ Not configured');
        
        console.log('\n✅ Setup complete\!');
        console.log('   You can now start the server with: npm run dev');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the setup
setupApiKeys().catch(console.error);
