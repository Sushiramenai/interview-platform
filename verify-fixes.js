const fs = require('fs').promises;
const path = require('path');
const ConfigManager = require('./src/utils/config_manager');

async function verifyFixes() {
  console.log('🔍 Verifying Platform Fixes\n');
  console.log('================================\n');

  let issues = 0;
  let successes = 0;

  // 1. Check directories
  console.log('📁 Checking required directories...');
  const dirs = ['data', 'src/roles', 'src/reports', 'uploads', 'transcripts', 'temp'];
  
  for (const dir of dirs) {
    try {
      await fs.access(path.join(__dirname, dir));
      console.log(`✅ ${dir}/ exists`);
      successes++;
    } catch {
      console.log(`❌ ${dir}/ missing - run: mkdir ${dir}`);
      issues++;
    }
  }

  // 2. Check config manager
  console.log('\n🔧 Checking ConfigManager...');
  try {
    const cm = new ConfigManager();
    await cm.initialize();
    console.log('✅ ConfigManager initializes correctly');
    successes++;
    
    // Check if any API keys are configured
    const keys = await cm.getApiKeys();
    const keyCount = Object.keys(keys).length;
    if (keyCount > 0) {
      console.log(`✅ Found ${keyCount} configured API keys`);
      successes++;
    } else {
      console.log('⚠️  No API keys configured yet');
    }
  } catch (error) {
    console.log('❌ ConfigManager error:', error.message);
    issues++;
  }

  // 3. Check sample role
  console.log('\n📋 Checking role templates...');
  try {
    const roleFile = path.join(__dirname, 'src/roles/customer_support_specialist.json');
    await fs.access(roleFile);
    const role = JSON.parse(await fs.readFile(roleFile, 'utf8'));
    console.log(`✅ Sample role exists: ${role.role}`);
    successes++;
  } catch {
    console.log('⚠️  No sample role found (not critical)');
  }

  // 4. Check environment
  console.log('\n🌍 Checking environment...');
  if (process.env.SESSION_SECRET) {
    console.log('✅ SESSION_SECRET is set');
    successes++;
  } else {
    console.log('⚠️  SESSION_SECRET not set (will use default)');
  }

  // Summary
  console.log('\n================================');
  console.log('📊 Verification Summary');
  console.log('================================');
  console.log(`✅ Checks passed: ${successes}`);
  console.log(`❌ Issues found: ${issues}`);

  if (issues === 0) {
    console.log('\n🎉 All checks passed! Your platform is ready.');
    console.log('\nNext steps:');
    console.log('1. Start server: npm start');
    console.log('2. Login: http://localhost:3000/login');
    console.log('3. Configure API keys in admin panel');
  } else {
    console.log('\n⚠️  Some issues found. Please address them before starting.');
  }
}

verifyFixes().catch(console.error);