#!/usr/bin/env node

/**
 * Test script to verify OpenAI and ElevenLabs integrations
 * Run: node test-integrations.js
 */

const fs = require('fs').promises;
const path = require('path');

async function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.log('❌ No config.json found. Please run "node simple-setup.js" or configure via the web UI.');
        process.exit(1);
    }
}

async function testOpenAI(apiKey) {
    console.log('\n🧪 Testing OpenAI Integration...');
    
    if (!apiKey) {
        console.log('❌ OpenAI API key not configured');
        return false;
    }
    
    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Using fast model for testing
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say "OpenAI is working!" in exactly 5 words.' }
            ],
            max_tokens: 50
        });
        
        console.log('✅ OpenAI API is working!');
        console.log(`   Response: ${response.choices[0].message.content}`);
        return true;
    } catch (error) {
        console.log('❌ OpenAI API test failed:', error.message);
        return false;
    }
}

async function testElevenLabs(apiKey, voiceId) {
    console.log('\n🎙️ Testing ElevenLabs Integration...');
    
    if (!apiKey) {
        console.log('⚠️  ElevenLabs API key not configured (optional)');
        return false;
    }
    
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'EXAVITQu4vr4xnSDxMaL'}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: "Testing voice synthesis.",
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.75,
                        similarity_boost: 0.75
                    }
                })
            }
        );
        
        if (response.ok) {
            console.log('✅ ElevenLabs API is working!');
            console.log('   Voice synthesis successful');
            return true;
        } else {
            const error = await response.text();
            console.log('❌ ElevenLabs API test failed:', error);
            return false;
        }
    } catch (error) {
        console.log('❌ ElevenLabs API test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🔍 Senbird Integration Test                      ║
╚═══════════════════════════════════════════════════════════╝
`);

    const config = await loadConfig();
    
    const openaiOk = await testOpenAI(config.openai_api_key);
    const elevenLabsOk = await testElevenLabs(config.elevenlabs_api_key, config.elevenlabs_voice_id);
    
    console.log('\n📊 Test Summary:');
    console.log(`   OpenAI:     ${openaiOk ? '✅ Working' : '❌ Not working'}`);
    console.log(`   ElevenLabs: ${elevenLabsOk ? '✅ Working' : '⚠️ Not configured'}`);
    
    if (openaiOk) {
        console.log('\n✨ Your interview platform is ready to use!');
        console.log('   Run "npm start" to begin.');
    } else {
        console.log('\n⚠️  Please configure your OpenAI API key to use the platform.');
        console.log('   Run "npm start" and click the settings icon to add your API key.');
    }
}

main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});