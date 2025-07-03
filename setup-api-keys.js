const ConfigManager = require('./src/utils/config_manager');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupApiKeys() {
  console.log('\n🔧 API Key Setup Helper\n');
  
  const configManager = new ConfigManager();
  await configManager.initialize();
  
  const keys = {};
  
  // Get Claude API Key
  keys.CLAUDE_API_KEY = await new Promise(resolve => {
    rl.question('Enter Claude API Key (sk-ant-...): ', resolve);
  });
  
  // Get Google Service Account JSON
  console.log('\nPaste Google Service Account JSON (press Enter twice when done):');
  let googleJson = '';
  let emptyLines = 0;
  
  await new Promise(resolve => {
    rl.on('line', (line) => {
      if (line === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          resolve();
        }
      } else {
        emptyLines = 0;
        googleJson += line + '\n';
      }
    });
  });
  
  keys.GOOGLE_CREDENTIALS = googleJson.trim();
  
  // Get ElevenLabs API Key
  keys.ELEVENLABS_API_KEY = await new Promise(resolve => {
    rl.question('\nEnter ElevenLabs API Key: ', resolve);
  });
  
  // Optional Recall.ai
  const useRecall = await new Promise(resolve => {
    rl.question('\nDo you have a Recall.ai API key? (y/n): ', answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
  
  if (useRecall) {
    keys.RECALL_API_KEY = await new Promise(resolve => {
      rl.question('Enter Recall.ai API Key: ', resolve);
    });
  }
  
  rl.close();
  
  // Save keys
  console.log('\n💾 Saving API keys...');
  
  for (const [key, value] of Object.entries(keys)) {
    if (value) {
      await configManager.setApiKey(key, value);
      console.log(`✅ Saved ${key}`);
    }
  }
  
  console.log('\n✨ Setup complete! You can now start the server and use the platform.');
}

setupApiKeys().catch(console.error);