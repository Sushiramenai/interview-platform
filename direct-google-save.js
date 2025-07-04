#!/usr/bin/env node

const ConfigManager = require('./src/utils/config_manager');

// PASTE YOUR GOOGLE CREDENTIALS JSON HERE
const GOOGLE_CREDS = {
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR-PRIVATE-KEY-HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your-cert-url"
};

async function save() {
    console.log('Saving Google credentials...');
    
    const configManager = new ConfigManager();
    await configManager.initialize();
    
    try {
        await configManager.setApiKey('GOOGLE_CREDENTIALS', JSON.stringify(GOOGLE_CREDS));
        console.log('✅ Google credentials saved successfully!');
        console.log('Please restart your server.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

save();