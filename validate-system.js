#!/usr/bin/env node

/**
 * System validation for Senbird Interview Platform
 * Tests based on actual file structure
 */

const fs = require('fs').promises;
const path = require('path');

// Test results
const results = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function log(message, type = 'info') {
    const symbols = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    console.log(`${symbols[type]} ${message}`);
}

async function test(name, fn, isWarning = false) {
    try {
        await fn();
        results.passed++;
        log(`${name}`, 'success');
        return true;
    } catch (error) {
        if (isWarning) {
            results.warnings++;
            log(`${name}: ${error.message}`, 'warning');
        } else {
            results.failed++;
            log(`${name}: ${error.message}`, 'error');
        }
        return false;
    }
}

// Core system tests
async function runTests() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║        🔍 Senbird Platform Validation                     ║
╚═══════════════════════════════════════════════════════════╝
`);

    console.log('🔧 Core Files:');
    
    // Test core files
    await test('server.js exists', async () => {
        await fs.access('server.js');
    });
    
    await test('package.json valid', async () => {
        const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
        if (!pkg.dependencies.openai) throw new Error('OpenAI dependency missing');
        if (!pkg.dependencies.express) throw new Error('Express dependency missing');
        if (!pkg.dependencies['socket.io']) throw new Error('Socket.io dependency missing');
    });
    
    await test('Replit config', async () => {
        const nix = await fs.readFile('replit.nix', 'utf8');
        const config = await fs.readFile('.replit', 'utf8');
        if (!nix.includes('nodejs_20')) throw new Error('Wrong Node.js version');
        if (!config.includes('stable-23_11')) throw new Error('Wrong nixpkgs channel');
    });

    console.log('\n📁 View Files:');
    
    // Test view files
    await test('HR Dashboard', async () => {
        const html = await fs.readFile('views/hr-dashboard.html', 'utf8');
        if (!html.includes('Interview Templates')) throw new Error('Missing templates section');
        if (!html.includes('settingsIcon')) throw new Error('Missing settings icon');
    });
    
    await test('Interview Room', async () => {
        const html = await fs.readFile('views/interview.html', 'utf8');
        if (!html.includes('video')) throw new Error('Missing video elements');
        if (!html.includes('RTCPeerConnection')) throw new Error('Missing WebRTC');
    });
    
    await test('Results Page', async () => {
        await fs.access('views/results.html');
    });

    console.log('\n🎨 Assets:');
    
    // Test assets
    await test('CSS Framework', async () => {
        await fs.access('public/css/design-system.css');
    });
    
    await test('Interview Scripts', async () => {
        await fs.access('public/js/interview-room.js');
    });
    
    await test('Logo/Branding', async () => {
        const logoExists = await fs.access('public/images/logo.png')
            .then(() => true)
            .catch(() => false);
        if (!logoExists) {
            const reminder = await fs.readFile('public/images/ADD_LOGO_HERE.txt', 'utf8');
            throw new Error('Logo not added yet (reminder file exists)');
        }
    }, true); // This is a warning, not a failure

    console.log('\n🔌 Server Features:');
    
    // Test server implementation
    await test('OpenAI Integration', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        if (!server.includes('class AIInterviewer')) throw new Error('AIInterviewer class missing');
        if (!server.includes('OpenAI')) throw new Error('OpenAI import missing');
    });
    
    await test('ElevenLabs Voice', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        if (!server.includes('class VoiceService')) throw new Error('VoiceService class missing');
        if (!server.includes('elevenlabs')) throw new Error('ElevenLabs integration missing');
    });
    
    await test('WebSocket Support', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        if (!server.includes('io.on(\'connection')) throw new Error('Socket.io handlers missing');
    });
    
    await test('Configuration API', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        if (!server.includes('loadConfig')) throw new Error('Config loading missing');
    });

    console.log('\n🔒 Security:');
    
    // Security checks
    await test('API Key Protection', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        // Make sure API keys aren't logged
        const hasKeyLogging = server.match(/console\.log.*api.*key/i);
        if (hasKeyLogging) throw new Error('API keys might be logged');
    });
    
    await test('Evaluation Privacy', async () => {
        const server = await fs.readFile('server.js', 'utf8');
        // Check that evaluations are only sent to admin
        if (server.includes('evaluation') && !server.includes('admin')) {
            throw new Error('Evaluations might be visible to candidates');
        }
    });

    console.log('\n🚦 Missing Features Check:');
    
    // Check for missing expected features
    await test('Landing Page', async () => {
        // Check if index.html exists anywhere
        const hasIndex = await fs.access('public/index.html')
            .then(() => true)
            .catch(() => false);
        if (!hasIndex) throw new Error('No landing page (index.html) found');
    }, true); // Warning only

    // Summary
    console.log(`
📊 Validation Summary:
   ✅ Passed:   ${results.passed}
   ❌ Failed:   ${results.failed}
   ⚠️  Warnings: ${results.warnings}
`);

    if (results.failed === 0) {
        console.log('✨ Core system validation passed!');
        console.log('\n📝 Notes:');
        if (results.warnings > 0) {
            console.log('   - Some optional features are missing (see warnings above)');
        }
        console.log('   - Remember to add your API keys via the settings icon');
        console.log('   - The system uses views/ directory for HTML files');
        console.log('\n🚀 Ready to deploy on Replit!');
    } else {
        console.log('❌ Critical issues found. Please fix the errors above.');
        process.exit(1);
    }
}

// Additional checks
async function checkDataStructure() {
    console.log('\n📂 Data Directory Structure:');
    
    const dirs = [
        'data/recordings',
        'data/results',
        'data/templates'
    ];
    
    for (const dir of dirs) {
        const exists = await fs.access(dir)
            .then(() => true)
            .catch(() => false);
        
        if (exists) {
            log(`${dir}`, 'success');
        } else {
            log(`${dir} (will be created on first use)`, 'warning');
        }
    }
}

// Run all validations
async function main() {
    try {
        await runTests();
        await checkDataStructure();
        
        console.log('\n💡 Quick Start:');
        console.log('   1. Run: npm start');
        console.log('   2. Open: http://localhost:3000/hr-dashboard.html');
        console.log('   3. Click settings icon to add API keys');
        console.log('   4. Create interview templates');
        console.log('   5. Share interview link with candidates');
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        process.exit(1);
    }
}

main();