const ConfigManager = require('./src/utils/config_manager');
const ServiceInitializer = require('./src/utils/service_initializer');

async function testInterviewStart() {
  console.log('🧪 Testing Interview Start Functionality\n');
  
  const configManager = new ConfigManager();
  await configManager.initialize();
  
  // 1. Check API keys
  console.log('1️⃣ Checking API keys:');
  const apiKeys = await configManager.getApiKeys();
  console.log('   Claude:', !!apiKeys.CLAUDE_API_KEY ? '✅' : '❌');
  console.log('   Google:', !!apiKeys.GOOGLE_CREDENTIALS ? '✅' : '❌');
  console.log('   ElevenLabs:', !!apiKeys.ELEVENLABS_API_KEY ? '✅' : '❌');
  
  if (!apiKeys.CLAUDE_API_KEY || !apiKeys.GOOGLE_CREDENTIALS || !apiKeys.ELEVENLABS_API_KEY) {
    console.log('\n❌ Missing required API keys. Please configure them first.');
    return;
  }
  
  // 2. Initialize services
  console.log('\n2️⃣ Initializing services:');
  try {
    await ServiceInitializer.initializeAllServices(configManager);
    console.log('   ✅ Services initialized');
    
    // Check environment variables
    console.log('\n3️⃣ Environment variables set:');
    console.log('   CLAUDE_API_KEY:', !!process.env.CLAUDE_API_KEY ? '✅' : '❌');
    console.log('   ELEVENLABS_API_KEY:', !!process.env.ELEVENLABS_API_KEY ? '✅' : '❌');
    console.log('   GOOGLE_CREDENTIALS:', !!process.env.GOOGLE_CREDENTIALS ? '✅' : '❌');
  } catch (error) {
    console.log('   ❌ Service initialization failed:', error.message);
    return;
  }
  
  // 3. Test orchestrator initialization
  console.log('\n4️⃣ Testing orchestrator:');
  try {
    const SelfHostedInterviewOrchestrator = require('./src/logic/self_hosted_interview_orchestrator');
    const orchestrator = new SelfHostedInterviewOrchestrator();
    console.log('   ✅ Orchestrator created');
    
    // Test with mock data
    console.log('\n5️⃣ Testing interview start (dry run):');
    console.log('   Candidate: Test User');
    console.log('   Email: test@example.com');
    console.log('   Role: software_engineer');
    
    // Note: We won't actually start an interview, just test the setup
    console.log('   ✅ All components ready');
    
  } catch (error) {
    console.log('   ❌ Orchestrator error:', error.message);
    console.log('   Stack:', error.stack);
  }
  
  // 4. Check role files
  console.log('\n6️⃣ Checking role templates:');
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const rolesDir = path.join(__dirname, 'src/roles');
    const files = await fs.readdir(rolesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`   Found ${jsonFiles.length} role templates:`);
    jsonFiles.forEach(f => console.log(`   - ${f}`));
    
  } catch (error) {
    console.log('   ❌ Error reading roles:', error.message);
  }
  
  console.log('\n✅ Test complete!');
  
  // Clean up
  await fs.unlink(__filename);
}

testInterviewStart().catch(console.error);