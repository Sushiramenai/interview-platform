const ConfigManager = require('./src/utils/config_manager');
const fs = require('fs').promises;
const path = require('path');

async function debugApiKeys() {
    console.log('🔍 Debugging API Key Storage...\n');
    
    const configManager = new ConfigManager();
    await configManager.initialize();
    
    // Check config file
    const configPath = path.join(__dirname, 'data/config.json');
    console.log('📁 Config file path:', configPath);
    
    try {
        const content = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(content);
        console.log('📋 Config file contents:');
        console.log(JSON.stringify(config, null, 2));
        console.log('\n✅ Config file is valid JSON');
    } catch (error) {
        console.log('❌ Error reading config:', error.message);
    }
    
    // Check API keys
    console.log('\n🔑 Checking API Keys...');
    const apiKeys = await configManager.getApiKeys();
    
    console.log('Claude API Key:', apiKeys.CLAUDE_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('Google Credentials:', apiKeys.GOOGLE_CREDENTIALS ? '✅ Set' : '❌ Not set');
    console.log('ElevenLabs API Key:', apiKeys.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Not set');
    
    // Test saving a key
    console.log('\n🧪 Testing key save functionality...');
    try {
        await configManager.setApiKey('TEST_KEY', 'test-value-123');
        console.log('✅ Test key saved');
        
        // Verify it was saved
        const newKeys = await configManager.getApiKeys();
        if (newKeys.TEST_KEY === 'test-value-123') {
            console.log('✅ Test key verified');
            
            // Clean up
            const config = await configManager.getConfig();
            delete config.apiKeys.TEST_KEY;
            await configManager.saveConfig(config);
            console.log('✅ Test key cleaned up');
        } else {
            console.log('❌ Test key verification failed');
        }
    } catch (error) {
        console.log('❌ Error during test:', error.message);
    }
    
    // Check environment variables
    console.log('\n🌍 Environment Variables:');
    console.log('CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('GOOGLE_CREDENTIALS:', process.env.GOOGLE_CREDENTIALS ? '✅ Set' : '❌ Not set');
    console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Not set');
    
    console.log('\n📝 Recommendations:');
    if (!apiKeys.CLAUDE_API_KEY && !apiKeys.GOOGLE_CREDENTIALS && !apiKeys.ELEVENLABS_API_KEY) {
        console.log('1. API keys are not saved in config.json');
        console.log('2. Try saving keys through the admin panel again');
        console.log('3. Check file permissions on data/config.json');
        console.log('4. Ensure the data directory exists and is writable');
    }
}

debugApiKeys().catch(console.error);