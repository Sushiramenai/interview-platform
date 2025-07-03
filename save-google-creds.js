#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const ConfigManager = require('./src/utils/config_manager');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function saveGoogleCredentials() {
    console.log('🔐 Google Credentials Setup\n');
    console.log('This tool helps you save Google Service Account credentials');
    console.log('when the web interface times out on Replit.\n');
    
    try {
        const configManager = new ConfigManager();
        await configManager.initialize();
        
        console.log('Please paste your Google Service Account JSON below.');
        console.log('(It should start with {"type": "service_account"...})\n');
        console.log('Paste the JSON and press Enter twice when done:\n');
        
        let jsonInput = '';
        let emptyLineCount = 0;
        
        rl.on('line', (line) => {
            if (line.trim() === '') {
                emptyLineCount++;
                if (emptyLineCount >= 2 && jsonInput.trim()) {
                    rl.pause();
                }
            } else {
                emptyLineCount = 0;
                jsonInput += line + '\n';
            }
        });
        
        await new Promise(resolve => {
            rl.once('pause', resolve);
            rl.resume();
        });
        
        console.log('\n📝 Processing credentials...');
        
        // Validate JSON
        let parsed;
        try {
            parsed = JSON.parse(jsonInput.trim());
        } catch (e) {
            console.error('❌ Invalid JSON format:', e.message);
            process.exit(1);
        }
        
        // Check required fields
        if (!parsed.type || parsed.type !== 'service_account') {
            console.error('❌ Invalid credentials: must be a service account');
            process.exit(1);
        }
        
        if (!parsed.client_email || !parsed.private_key) {
            console.error('❌ Invalid credentials: missing required fields');
            process.exit(1);
        }
        
        console.log('✅ Valid Google Service Account detected');
        console.log('📧 Service Account:', parsed.client_email);
        console.log('📦 Credentials size:', jsonInput.trim().length, 'characters');
        
        // Save the credentials
        console.log('\n💾 Saving credentials (this may take a moment)...');
        
        const startTime = Date.now();
        await configManager.setApiKey('GOOGLE_CREDENTIALS', jsonInput.trim());
        const duration = Date.now() - startTime;
        
        console.log(`✅ Credentials saved successfully in ${duration}ms`);
        
        // Verify
        const verification = await configManager.verifyApiKeys();
        if (verification.google) {
            console.log('✅ Verification passed - Google credentials are properly saved');
            
            // Test the credentials
            const testResult = await configManager.testGoogle(jsonInput.trim());
            if (testResult.success) {
                console.log('✅ API test passed -', testResult.message);
            } else {
                console.log('⚠️  API test failed:', testResult.message);
                console.log('   Make sure the service account has Calendar API access');
            }
        } else {
            console.log('❌ Verification failed - credentials may not have saved properly');
        }
        
        console.log('\n🎉 Done! You can now use the web interface.');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
saveGoogleCredentials();