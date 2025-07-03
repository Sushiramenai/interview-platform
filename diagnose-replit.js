const fs = require('fs').promises;
const path = require('path');

async function diagnoseReplit() {
  console.log('🔍 Diagnosing Replit Configuration\n');
  
  // Check if running on Replit
  console.log('1️⃣ Environment Check:');
  console.log(`   REPL_SLUG: ${process.env.REPL_SLUG || 'Not set (not on Replit)'}`);
  console.log(`   REPL_OWNER: ${process.env.REPL_OWNER || 'Not set'}`);
  console.log(`   PORT: ${process.env.PORT || '3000'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  
  // Check data directory
  console.log('\n2️⃣ Data Directory:');
  try {
    const dataDir = path.join(__dirname, 'data');
    const stats = await fs.stat(dataDir);
    console.log(`   ✅ Data directory exists`);
    
    // Check if writable
    try {
      const testFile = path.join(dataDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log(`   ✅ Data directory is writable`);
    } catch (e) {
      console.log(`   ❌ Data directory is NOT writable: ${e.message}`);
    }
  } catch (e) {
    console.log(`   ❌ Data directory missing`);
    // Try to create it
    try {
      await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
      console.log(`   ✅ Created data directory`);
    } catch (e2) {
      console.log(`   ❌ Cannot create data directory: ${e2.message}`);
    }
  }
  
  // Check config.json
  console.log('\n3️⃣ Configuration File:');
  const configPath = path.join(__dirname, 'data', 'config.json');
  try {
    const config = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(config);
    console.log(`   ✅ config.json exists`);
    console.log(`   - Has API keys: ${parsed.apiKeys ? 'Yes' : 'No'}`);
    console.log(`   - Has settings: ${parsed.settings ? 'Yes' : 'No'}`);
  } catch (e) {
    console.log(`   ⚠️  config.json not found or invalid`);
    console.log(`   This is normal for first-time setup`);
  }
  
  // Check memory usage
  console.log('\n4️⃣ Memory Usage:');
  const used = process.memoryUsage();
  for (let key in used) {
    console.log(`   ${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
  
  // Check if ConfigManager can initialize
  console.log('\n5️⃣ ConfigManager Test:');
  try {
    const ConfigManager = require('./src/utils/config_manager');
    const cm = new ConfigManager();
    await cm.initialize();
    console.log(`   ✅ ConfigManager initialized successfully`);
    
    // Try to save a test key
    try {
      await cm.setApiKey('TEST_KEY', 'test-value');
      const keys = await cm.getApiKeys();
      if (keys.TEST_KEY === 'test-value') {
        console.log(`   ✅ Can save and retrieve API keys`);
        // Clean up
        delete keys.TEST_KEY;
        await cm._saveConfig();
      } else {
        console.log(`   ❌ API key save/retrieve mismatch`);
      }
    } catch (e) {
      console.log(`   ❌ Cannot save API keys: ${e.message}`);
    }
  } catch (e) {
    console.log(`   ❌ ConfigManager initialization failed: ${e.message}`);
  }
  
  console.log('\n📋 Recommendations:');
  if (process.env.REPL_SLUG) {
    console.log('- You are running on Replit');
    console.log('- Use the setup-api-keys-v2.js script to configure API keys');
    console.log('- Make sure to restart the repl after configuration');
  } else {
    console.log('- You are running locally');
    console.log('- The web UI should work normally');
  }
}

diagnoseReplit().catch(console.error);