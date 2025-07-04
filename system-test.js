#!/usr/bin/env node

/**
 * Comprehensive system test for Senbird Interview Platform
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    tests: []
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

async function test(name, fn) {
    try {
        await fn();
        results.passed++;
        results.tests.push({ name, status: 'passed' });
        log(`${name}`, 'success');
    } catch (error) {
        results.failed++;
        results.tests.push({ name, status: 'failed', error: error.message });
        log(`${name}: ${error.message}`, 'error');
    }
}

// Test 1: Check file structure
async function testFileStructure() {
    const requiredFiles = [
        'server.js',
        'package.json',
        'public/index.html',
        'public/hr-dashboard.html',
        'public/interview.html',
        'replit.nix',
        '.replit'
    ];
    
    for (const file of requiredFiles) {
        const exists = await fs.access(path.join(__dirname, file))
            .then(() => true)
            .catch(() => false);
        if (!exists) {
            throw new Error(`Missing required file: ${file}`);
        }
    }
}

// Test 2: Check package.json integrity
async function testPackageJson() {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    
    if (!packageJson.dependencies.openai) {
        throw new Error('OpenAI dependency missing');
    }
    if (!packageJson.dependencies.express) {
        throw new Error('Express dependency missing');
    }
    if (!packageJson.dependencies['socket.io']) {
        throw new Error('Socket.io dependency missing');
    }
}

// Test 3: Check server.js for required classes
async function testServerClasses() {
    const serverCode = await fs.readFile('server.js', 'utf8');
    
    if (!serverCode.includes('class AIInterviewer')) {
        throw new Error('AIInterviewer class missing');
    }
    if (!serverCode.includes('class VoiceService')) {
        throw new Error('VoiceService class missing');
    }
    if (!serverCode.includes('getOpenAIClient')) {
        throw new Error('OpenAI client initialization missing');
    }
}

// Test 4: Check HTML files for required elements
async function testHTMLFiles() {
    const indexHtml = await fs.readFile('public/index.html', 'utf8');
    const hrHtml = await fs.readFile('public/hr-dashboard.html', 'utf8');
    const interviewHtml = await fs.readFile('public/interview.html', 'utf8');
    
    // Check index.html
    if (!indexHtml.includes('Start Interview')) {
        throw new Error('Start Interview button missing in index.html');
    }
    
    // Check HR dashboard
    if (!hrHtml.includes('Interview Templates')) {
        throw new Error('Interview Templates section missing in HR dashboard');
    }
    if (!hrHtml.includes('settingsIcon')) {
        throw new Error('Settings icon missing in HR dashboard');
    }
    
    // Check interview page
    if (!interviewHtml.includes('video') || !interviewHtml.includes('remoteVideo')) {
        throw new Error('Video elements missing in interview page');
    }
}

// Test 5: Check configuration handling
async function testConfiguration() {
    const serverCode = await fs.readFile('server.js', 'utf8');
    
    if (!serverCode.includes('loadConfig')) {
        throw new Error('Config loading function missing');
    }
    if (!serverCode.includes('/api/config')) {
        throw new Error('Config API endpoint missing');
    }
}

// Test 6: Check template system
async function testTemplateSystem() {
    const hrHtml = await fs.readFile('public/hr-dashboard.html', 'utf8');
    
    if (!hrHtml.includes('loadTemplates') || !hrHtml.includes('saveTemplates')) {
        throw new Error('Template management functions missing');
    }
    if (!hrHtml.includes('localStorage')) {
        throw new Error('LocalStorage usage for templates missing');
    }
}

// Test 7: Test server startup (without actually starting it)
async function testServerStartup() {
    const serverCode = await fs.readFile('server.js', 'utf8');
    
    if (!serverCode.includes('app.listen')) {
        throw new Error('Server listen call missing');
    }
    if (!serverCode.includes('socket.on')) {
        throw new Error('Socket.io event handlers missing');
    }
}

// Test 8: Check Replit configuration
async function testReplitConfig() {
    const replitNix = await fs.readFile('replit.nix', 'utf8');
    const replitConfig = await fs.readFile('.replit', 'utf8');
    
    if (!replitNix.includes('nodejs_20')) {
        throw new Error('nodejs_20 not found in replit.nix');
    }
    if (!replitConfig.includes('stable-23_11')) {
        throw new Error('Wrong nixpkgs channel in .replit');
    }
}

// Test 9: Check security features
async function testSecurity() {
    const serverCode = await fs.readFile('server.js', 'utf8');
    const hrHtml = await fs.readFile('public/hr-dashboard.html', 'utf8');
    
    // Check that evaluation scores are not sent to interview page
    if (serverCode.includes('socket.emit') && serverCode.match(/socket\.emit.*evaluation.*score/)) {
        // Make sure it's only emitting to admin
        if (!serverCode.includes('admin-evaluation')) {
            throw new Error('Evaluation scores might be visible to candidates');
        }
    }
    
    // Check API key handling
    if (serverCode.includes('console.log') && serverCode.includes('api_key')) {
        throw new Error('API keys might be logged to console');
    }
}

// Test 10: Check WebRTC implementation
async function testWebRTC() {
    const interviewHtml = await fs.readFile('public/interview.html', 'utf8');
    
    if (!interviewHtml.includes('RTCPeerConnection')) {
        throw new Error('WebRTC peer connection missing');
    }
    if (!interviewHtml.includes('getUserMedia')) {
        throw new Error('getUserMedia for camera/mic access missing');
    }
}

// Main test runner
async function runTests() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🔍 Senbird System Test Suite                     ║
╚═══════════════════════════════════════════════════════════╝
`);

    await test('File Structure', testFileStructure);
    await test('Package.json Dependencies', testPackageJson);
    await test('Server Classes', testServerClasses);
    await test('HTML Files', testHTMLFiles);
    await test('Configuration Handling', testConfiguration);
    await test('Template System', testTemplateSystem);
    await test('Server Startup Code', testServerStartup);
    await test('Replit Configuration', testReplitConfig);
    await test('Security Features', testSecurity);
    await test('WebRTC Implementation', testWebRTC);

    console.log(`
📊 Test Results:
   Passed: ${results.passed}
   Failed: ${results.failed}
   Total:  ${results.tests.length}
`);

    if (results.failed > 0) {
        console.log('Failed Tests:');
        results.tests
            .filter(t => t.status === 'failed')
            .forEach(t => console.log(`   ❌ ${t.name}: ${t.error}`));
    }

    if (results.failed === 0) {
        console.log('✨ All system tests passed! The platform is ready for deployment.');
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.');
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});