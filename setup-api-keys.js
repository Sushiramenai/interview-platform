const ConfigManager = require('./src/utils/config_manager');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupApiKeys() {
  console.log('\n🔧 API Key Setup Helper\n');
  console.log('This tool helps you configure API keys directly.\n');
  
  const configManager = new ConfigManager();
  await configManager.initialize();
  
  // Check existing keys
  const existingKeys = await configManager.getApiKeys();
  const hasClaudeKey = !!existingKeys.CLAUDE_API_KEY;
  const hasGoogleCreds = !!existingKeys.GOOGLE_CREDENTIALS;
  const hasElevenLabsKey = !!existingKeys.ELEVENLABS_API_KEY;
  
  console.log('Current Status:');
  console.log(`  Claude AI: ${hasClaudeKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Google Services: ${hasGoogleCreds ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  ElevenLabs: ${hasElevenLabsKey ? '✅ Configured' : '❌ Not configured'}\n`);
  
  const keys = {};
  
  // Get Claude API Key
  if (!hasClaudeKey || await askYesNo('Update Claude API Key?')) {
    console.log('\n1️⃣ Claude AI (Required)');
    console.log('   Get your key from: https://console.anthropic.com/');
    keys.CLAUDE_API_KEY = await new Promise(resolve => {
      rl.question('   Enter Claude API Key (sk-ant-...): ', resolve);
    });
  }
  
  // Get Google Service Account JSON
  if (!hasGoogleCreds || await askYesNo('Update Google Service Account?')) {
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
      console.log('   ❌ Invalid JSON format. Skipping Google credentials.');
    }
  }
  
  // Get ElevenLabs API Key
  if (!hasElevenLabsKey || await askYesNo('Update ElevenLabs API Key?')) {
    console.log('\n3️⃣ ElevenLabs (Required)');
    console.log('   Get your key from: https://elevenlabs.io/');
    keys.ELEVENLABS_API_KEY = await new Promise(resolve => {
      rl.question('   Enter ElevenLabs API Key: ', resolve);
    });
  }
  
  rl.close();
  
  // Save keys
  if (Object.keys(keys).length === 0) {
    console.log('\n✅ No keys to update. Configuration unchanged.');
    return;
  }
  
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
  } else {
    console.log(`\n✨ Successfully saved ${savedCount} API keys!`);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. If running on Replit: Stop and restart your repl');
  console.log('2. Login to the admin panel');
  console.log('3. Your API keys should now be configured');
  console.log('4. Try creating an interview session');
}

async function askYesNo(question) {
  return new Promise(resolve => {
    rl.question(`${question} (y/n): `, answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

setupApiKeys().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});