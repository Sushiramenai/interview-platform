const ConfigManager = require('./config_manager');

class ServiceInitializer {
    static async getServiceWithConfig(ServiceClass, configManager) {
        const service = new ServiceClass();
        const apiKeys = await configManager.getApiKeys();
        
        // Override environment variables with configured keys
        if (apiKeys.CLAUDE_API_KEY) {
            process.env.CLAUDE_API_KEY = apiKeys.CLAUDE_API_KEY;
        }
        if (apiKeys.GOOGLE_CREDENTIALS) {
            const creds = JSON.parse(apiKeys.GOOGLE_CREDENTIALS);
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email;
            process.env.GOOGLE_PRIVATE_KEY = creds.private_key;
        }
        if (apiKeys.ELEVENLABS_API_KEY) {
            process.env.ELEVENLABS_API_KEY = apiKeys.ELEVENLABS_API_KEY;
            process.env.ENABLE_VOICE = 'true';
        }
        if (apiKeys.RECALL_API_KEY) {
            process.env.RECALL_API_KEY = apiKeys.RECALL_API_KEY;
            process.env.ENABLE_RECORDING = 'true';
        }
        
        return service;
    }

    static async initializeAllServices(configManager) {
        const apiKeys = await configManager.getApiKeys();
        
        // Set all API keys in environment
        for (const [key, value] of Object.entries(apiKeys)) {
            if (value) {
                process.env[key] = value;
                
                // Special handling for Google credentials
                if (key === 'GOOGLE_CREDENTIALS') {
                    try {
                        const creds = JSON.parse(value);
                        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email;
                        process.env.GOOGLE_PRIVATE_KEY = creds.private_key;
                    } catch (e) {
                        console.error('Invalid Google credentials format');
                    }
                }
            }
        }
        
        // Enable features based on API key presence
        if (apiKeys.ELEVENLABS_API_KEY) {
            process.env.ENABLE_VOICE = 'true';
        }
        if (apiKeys.RECALL_API_KEY) {
            process.env.ENABLE_RECORDING = 'true';
            // Set webhook URL for Recall.ai
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            process.env.RECALL_WEBHOOK_URL = `${baseUrl}/api/webhooks/recall`;
        }
    }
}

module.exports = ServiceInitializer;