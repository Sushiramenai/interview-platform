#!/usr/bin/env node

/**
 * System Health Check - Verifies the interview platform is properly configured
 */

const fs = require('fs').promises;
const path = require('path');

async function checkSystem() {
    console.log('\n🔍 Senbird Interview System Health Check\n');
    
    const checks = {
        configuration: true,
        aiOrchestrator: true,
        directories: true,
        apiKeys: true,
        overall: true
    };
    
    // 1. Check configuration
    console.log('1. Checking configuration...');
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configExists = await fs.access(configPath).then(() => true).catch(() => false);
        
        if (configExists) {
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            
            // Verify no interview_guidelines exist
            if (config.interview_guidelines) {
                console.log('   ❌ Old interview_guidelines found - should be removed');
                checks.configuration = false;
            } else {
                console.log('   ✅ Configuration clean - no guidelines section');
            }
            
            // Check API keys
            if (config.openai_api_key) {
                console.log('   ✅ OpenAI API key configured');
            } else {
                console.log('   ⚠️  OpenAI API key not configured');
                checks.apiKeys = false;
            }
            
            if (config.elevenlabs_api_key) {
                console.log('   ✅ ElevenLabs API key configured');
            } else {
                console.log('   ℹ️  ElevenLabs API key not configured (optional)');
            }
        } else {
            console.log('   ℹ️  No config.json file - using defaults');
        }
    } catch (error) {
        console.log('   ❌ Error checking configuration:', error.message);
        checks.configuration = false;
    }
    
    // 2. Check AI Orchestrator
    console.log('\n2. Checking AI Orchestrator...');
    try {
        const orchestratorPath = path.join(__dirname, 'server-new-ai.js');
        const orchestratorExists = await fs.access(orchestratorPath).then(() => true).catch(() => false);
        
        if (orchestratorExists) {
            console.log('   ✅ AI Orchestrator file exists');
            
            // Check for optimal settings
            const content = await fs.readFile(orchestratorPath, 'utf8');
            if (content.includes('maxFollowUps: 2') && content.includes('followUpProbability: 0.3')) {
                console.log('   ✅ Optimal interview settings configured');
            } else {
                console.log('   ⚠️  Check optimal settings in orchestrator');
            }
        } else {
            console.log('   ❌ AI Orchestrator file missing');
            checks.aiOrchestrator = false;
        }
    } catch (error) {
        console.log('   ❌ Error checking AI Orchestrator:', error.message);
        checks.aiOrchestrator = false;
    }
    
    // 3. Check data directories
    console.log('\n3. Checking data directories...');
    const requiredDirs = ['data', 'data/recordings', 'data/results', 'data/templates'];
    for (const dir of requiredDirs) {
        const dirPath = path.join(__dirname, dir);
        const exists = await fs.access(dirPath).then(() => true).catch(() => false);
        if (exists) {
            console.log(`   ✅ ${dir} exists`);
        } else {
            console.log(`   ⚠️  ${dir} missing (will be created on startup)`);
        }
    }
    
    // 4. Check server.js for proper integration
    console.log('\n4. Checking server integration...');
    try {
        const serverPath = path.join(__dirname, 'server.js');
        const serverContent = await fs.readFile(serverPath, 'utf8');
        
        if (serverContent.includes('AIInterviewOrchestrator')) {
            console.log('   ✅ AI Orchestrator integrated');
        } else {
            console.log('   ❌ AI Orchestrator not integrated');
            checks.overall = false;
        }
        
        if (!serverContent.includes('interview_guidelines')) {
            console.log('   ✅ Guidelines removed from server');
        } else {
            console.log('   ❌ Guidelines still present in server');
            checks.overall = false;
        }
    } catch (error) {
        console.log('   ❌ Error checking server:', error.message);
        checks.overall = false;
    }
    
    // 5. Check UI for guidelines removal
    console.log('\n5. Checking UI...');
    try {
        const dashboardPath = path.join(__dirname, 'views/hr-dashboard.html');
        const dashboardContent = await fs.readFile(dashboardPath, 'utf8');
        
        if (!dashboardContent.includes('AI Guidelines') && !dashboardContent.includes('guidelinesTab')) {
            console.log('   ✅ Guidelines removed from dashboard');
        } else {
            console.log('   ❌ Guidelines still present in dashboard');
            checks.overall = false;
        }
    } catch (error) {
        console.log('   ❌ Error checking dashboard:', error.message);
        checks.overall = false;
    }
    
    // Summary
    console.log('\n📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    
    const allPassed = Object.values(checks).every(check => check);
    
    if (allPassed) {
        console.log('✅ System is properly configured!');
        console.log('\nThe interview system is using optimal defaults:');
        console.log('- Professional interview style');
        console.log('- Smart follow-up questions (30% chance, max 2)');
        console.log('- Natural conversation flow');
        console.log('- No confusing guidelines to configure');
    } else {
        console.log('⚠️  Some issues detected');
        console.log('\nRecommendations:');
        if (!checks.apiKeys) {
            console.log('- Configure OpenAI API key in settings');
        }
        if (!checks.configuration || !checks.overall) {
            console.log('- Pull latest changes from GitHub');
            console.log('- Restart the server');
        }
    }
    
    console.log('\n🚀 Ready to run: npm start\n');
}

// Run the health check
checkSystem().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
});