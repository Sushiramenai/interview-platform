const ConfigManager = require('./src/utils/config_manager');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupApiKeys() {
  console.log('\n🔧 API Key Setup Helper (Replit Fallback)\n');
  console.log('This tool will help you configure API keys directly, bypassing the web UI.\n');
  
  const configManager = new ConfigManager();
  await configManager.initialize();
  
  const keys = {};
  
  // Get Claude API Key
  console.log('1️⃣ Claude AI (Required)');
  console.log('   Get your key from: https://console.anthropic.com/');
  keys.CLAUDE_API_KEY = await new Promise(resolve => {
    rl.question('   Enter Claude API Key (sk-ant-...): ', resolve);
  });
  
  // Get Google Service Account JSON
  console.log('\n2️⃣ Google Service Account (Required)');
  console.log('   This should be a JSON file from Google Cloud Console');
  console.log('   Paste the entire JSON content below, then press Enter twice:\n');
  
  let googleJson = '';
  let emptyLines = 0;
  
  await new Promise(resolve => {
    const lineHandler = (line) => {
      if (line === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          rl.removeListener('line', lineHandler);
          resolve();
        }
      } else {
        emptyLines = 0;
        googleJson += line + '\n';
      }
    };
    rl.on('line', lineHandler);
  });
  
  // Validate JSON
  try {
    JSON.parse(googleJson.trim());
    keys.GOOGLE_CREDENTIALS = googleJson.trim();
    console.log('   ✅ Valid JSON detected');
  } catch (e) {
    console.log('   ❌ Invalid JSON format. Please check and try again.');
    rl.close();
    return;
  }
  
  // Get ElevenLabs API Key
  console.log('\n3️⃣ ElevenLabs (Required)');
  console.log('   Get your key from: https://elevenlabs.io/');
  keys.ELEVENLABS_API_KEY = await new Promise(resolve => {
    rl.question('   Enter ElevenLabs API Key: ', resolve);
  });
  
  rl.close();
  
  // Save keys
  console.log('\n💾 Saving API keys...');
  
  let savedCount = 0;
  const errors = [];
  
  for (const [key, value] of Object.entries(keys)) {
    if (value && value.trim()) {
      try {
        await configManager.setApiKey(key, value.trim());
        console.log(`   ✅ Saved ${key}`);
        savedCount++;
      } catch (error) {
        console.log(`   ❌ Failed to save ${key}: ${error.message}`);
        errors.push(`${key}: ${error.message}`);
      }
    }
  }
  
  if (errors.length > 0) {
    console.log('\n⚠️  Some keys failed to save:');
    errors.forEach(err => console.log(`   - ${err}`));
    console.log('\nPlease check the errors and try again.');
  } else {
    console.log(`\n✨ Successfully saved ${savedCount} API keys!`);
    console.log('\n📋 Next Steps:');
    console.log('1. Restart your Replit: Click "Stop" then "Run" button');
    console.log('2. Go to your Replit URL and login to admin panel');
    console.log('3. Your API keys should now be configured');
    console.log('4. Try creating an interview from the admin panel');
    
    // Test the configuration
    console.log('\n🔍 Testing configuration...');
    const ServiceInitializer = require('./src/utils/service_initializer');
    try {
      await ServiceInitializer.initializeAllServices(configManager);
      console.log('✅ All services initialized successfully!');
    } catch (error) {
      console.log(`⚠️  Service initialization warning: ${error.message}`);
      console.log('   This might resolve after restarting the server.');
    }
  }
}

setupApiKeys().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});