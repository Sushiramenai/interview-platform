const ConfigManager = require('./config_manager');

class SystemCheck {
    static async checkAllServices() {
        const configManager = new ConfigManager();
        await configManager.initialize();
        const apiKeys = await configManager.getApiKeys();
        
        const results = {
            claude: false,
            google: false,
            elevenlabs: false,
            overall: false
        };
        
        console.log('\n🔍 Checking system configuration...\n');
        
        // Check Claude AI
        try {
            if (!apiKeys.CLAUDE_API_KEY) {
                throw new Error('Claude API key not configured');
            }
            console.log('✅ Claude AI: Configured');
            results.claude = true;
        } catch (error) {
            console.log('❌ Claude AI: ' + error.message);
        }
        
        // Check Google Services
        try {
            if (!apiKeys.GOOGLE_CREDENTIALS) {
                throw new Error('Google credentials not configured');
            }
            const creds = JSON.parse(apiKeys.GOOGLE_CREDENTIALS);
            if (!creds.client_email || !creds.private_key) {
                throw new Error('Invalid Google credentials format');
            }
            console.log('✅ Google Services: Configured');
            results.google = true;
        } catch (error) {
            console.log('❌ Google Services: ' + error.message);
        }
        
        // Check ElevenLabs
        try {
            if (!apiKeys.ELEVENLABS_API_KEY) {
                throw new Error('ElevenLabs API key not configured');
            }
            console.log('✅ ElevenLabs: Configured');
            results.elevenlabs = true;
        } catch (error) {
            console.log('❌ ElevenLabs: ' + error.message);
        }
        
        // Overall status
        results.overall = results.claude && results.google && results.elevenlabs;
        
        if (results.overall) {
            console.log('\n✅ All required services are configured!');
        } else {
            console.log('\n❌ Some services are not configured. Please check the admin panel.');
        }
        
        return results;
    }
}

module.exports = SystemCheck;