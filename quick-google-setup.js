#!/usr/bin/env node

const ConfigManager = require('./src/utils/config_manager');
const fs = require('fs').promises;
const path = require('path');

console.log('🔧 Quick Google Credentials Setup\n');
console.log('This tool will add Google credentials from a file.\n');

async function setup() {
    const configManager = new ConfigManager();
    await configManager.initialize();
    
    // Check if credentials.json exists in the root
    const credPath = path.join(__dirname, 'credentials.json');
    
    try {
        console.log('Looking for credentials.json in project root...');
        const credContent = await fs.readFile(credPath, 'utf8');
        
        // Validate JSON
        const creds = JSON.parse(credContent);
        
        if (!creds.client_email || !creds.private_key) {
            console.error('❌ Invalid credentials file - missing client_email or private_key');
            return;
        }
        
        console.log('✅ Found valid Google credentials');
        console.log('   Service Account:', creds.client_email);
        
        // Save to config
        await configManager.setApiKey('GOOGLE_CREDENTIALS', credContent);
        
        console.log('✅ Google credentials saved successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Delete credentials.json for security');
        console.log('2. Restart your server');
        console.log('3. Try starting an interview again');
        
        // Offer to delete the credentials file
        console.log('\n🗑️  Deleting credentials.json for security...');
        await fs.unlink(credPath);
        console.log('✅ Credentials file deleted');
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('❌ credentials.json not found in project root');
            console.log('\n📝 Instructions:');
            console.log('1. Download your Google service account JSON file');
            console.log('2. Rename it to "credentials.json"');
            console.log('3. Upload it to your Replit project root');
            console.log('4. Run this script again: node quick-google-setup.js');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

setup().catch(console.error);