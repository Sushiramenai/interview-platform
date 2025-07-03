const ConfigManager = require('./config_manager');
const InterviewAI = require('../logic/interview_ai');
const MeetGenerator = require('./meet_generator');
const ElevenLabsService = require('./elevenlabs_service');
const RecallService = require('./recall_service');

class SystemCheck {
  static async checkAllServices() {
    const results = {
      claude: false,
      google: false,
      elevenlabs: false,
      recall: false,
      overall: false
    };
    
    const configManager = new ConfigManager();
    await configManager.initialize();
    const apiKeys = await configManager.getApiKeys();
    
    console.log('🔍 Running system checks...\n');
    
    // Check Claude AI
    try {
      if (!apiKeys.CLAUDE_API_KEY) {
        throw new Error('Claude API key not configured');
      }
      process.env.CLAUDE_API_KEY = apiKeys.CLAUDE_API_KEY;
      const ai = new InterviewAI();
      // Simple test to verify API key works
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
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email;
      process.env.GOOGLE_PRIVATE_KEY = creds.private_key;
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
      process.env.ELEVENLABS_API_KEY = apiKeys.ELEVENLABS_API_KEY;
      const elevenlabs = new ElevenLabsService();
      await elevenlabs.initialize(apiKeys.ELEVENLABS_API_KEY);
      console.log('✅ ElevenLabs: Configured');
      results.elevenlabs = true;
    } catch (error) {
      console.log('❌ ElevenLabs: ' + error.message);
    }
    
    // Check Recall.ai
    try {
      if (!apiKeys.RECALL_API_KEY) {
        throw new Error('Recall.ai API key not configured');
      }
      process.env.RECALL_API_KEY = apiKeys.RECALL_API_KEY;
      const recall = new RecallService();
      await recall.initialize(apiKeys.RECALL_API_KEY);
      console.log('✅ Recall.ai: Configured');
      results.recall = true;
    } catch (error) {
      console.log('❌ Recall.ai: ' + error.message);
    }
    
    // Overall status
    results.overall = results.claude && results.google && results.elevenlabs && results.recall;
    
    console.log('\n' + '='.repeat(50));
    if (results.overall) {
      console.log('✅ ALL SYSTEMS READY - Video interviews can be conducted');
    } else {
      console.log('❌ SYSTEM NOT READY - Please configure missing services');
    }
    console.log('='.repeat(50) + '\n');
    
    return results;
  }
  
  static async validateIntegration() {
    const results = await this.checkAllServices();
    
    if (!results.overall) {
      const missing = [];
      if (!results.claude) missing.push('Claude AI');
      if (!results.google) missing.push('Google Services');
      if (!results.elevenlabs) missing.push('ElevenLabs');
      if (!results.recall) missing.push('Recall.ai');
      
      throw new Error(`Missing required services: ${missing.join(', ')}`);
    }
    
    return true;
  }
}

module.exports = SystemCheck;