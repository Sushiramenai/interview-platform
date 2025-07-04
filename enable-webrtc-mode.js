#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

console.log('🎥 Enabling WebRTC Interview Mode\n');
console.log('This will configure the platform to use built-in video interviews');
console.log('instead of Google Meet integration.\n');

async function enableWebRTCMode() {
    try {
        // 1. Create public directories
        console.log('📁 Creating public directories...');
        await fs.mkdir(path.join(__dirname, 'public', 'js'), { recursive: true });
        
        // 2. Create or update .env file
        console.log('⚙️  Configuring environment...');
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        try {
            envContent = await fs.readFile(envPath, 'utf8');
        } catch (e) {
            // .env doesn't exist
        }
        
        // Add WebRTC mode flag
        if (!envContent.includes('USE_WEBRTC_MODE')) {
            envContent += '\n# WebRTC Interview Mode\nUSE_WEBRTC_MODE=true\n';
            await fs.writeFile(envPath, envContent);
            console.log('✅ WebRTC mode enabled in .env');
        }
        
        // 3. Update index.js to support WebRTC
        console.log('🔧 Updating server configuration...');
        const indexPath = path.join(__dirname, 'index.js');
        let indexContent = await fs.readFile(indexPath, 'utf8');
        
        // Add HTTP server creation if not exists
        if (!indexContent.includes('const server = http.createServer(app)')) {
            // Find where to insert
            const appCreationIndex = indexContent.indexOf('const app = express();');
            if (appCreationIndex !== -1) {
                const insertPoint = indexContent.indexOf('\n', appCreationIndex) + 1;
                const insertion = `\n// Create HTTP server for Socket.io\nconst http = require('http');\nconst server = http.createServer(app);\n`;
                indexContent = indexContent.slice(0, insertPoint) + insertion + indexContent.slice(insertPoint);
            }
            
            // Replace app.listen with server.listen
            indexContent = indexContent.replace(
                /app\.listen\(PORT, '0\.0\.0\.0', \(\) => {/,
                `// Initialize WebRTC server
if (process.env.USE_WEBRTC_MODE === 'true') {
    setTimeout(() => {
        try {
            const WebRTCInterviewServer = require('./src/webrtc/webrtc-interview-server');
            const webrtcServer = new WebRTCInterviewServer(server);
            console.log('🎥 WebRTC Interview Server initialized');
        } catch (error) {
            console.error('WebRTC server init error:', error);
        }
    }, 3000);
}

server.listen(PORT, '0.0.0.0', () => {`
            );
            
            await fs.writeFile(indexPath, indexContent);
            console.log('✅ Server updated for WebRTC support');
        }
        
        // Add static file serving for public/js
        if (!indexContent.includes("app.use('/js', express.static")) {
            const staticIndex = indexContent.indexOf("app.use(express.static('src/ui'));");
            if (staticIndex !== -1) {
                const insertPoint = indexContent.indexOf('\n', staticIndex) + 1;
                const insertion = `app.use('/js', express.static(path.join(__dirname, 'public/js')));\n`;
                indexContent = indexContent.slice(0, insertPoint) + insertion + indexContent.slice(insertPoint);
                await fs.writeFile(indexPath, indexContent);
            }
        }
        
        // Add interview room route
        if (!indexContent.includes('/interview/:sessionId')) {
            const candidateRoute = indexContent.indexOf("app.get('/candidate'");
            if (candidateRoute !== -1) {
                const insertPoint = indexContent.indexOf('});', candidateRoute) + 3;
                const insertion = `\n\n// WebRTC Interview Room\napp.get('/interview/:sessionId', (req, res) => {\n  res.sendFile(path.join(__dirname, 'src/webrtc/interview-room.html'));\n});`;
                indexContent = indexContent.slice(0, insertPoint) + insertion + indexContent.slice(insertPoint);
                await fs.writeFile(indexPath, indexContent);
            }
        }
        
        console.log('\n✅ WebRTC Mode Configuration Complete!\n');
        console.log('📝 Next steps:');
        console.log('1. Run: npm install socket.io');
        console.log('2. Configure your API keys:');
        console.log('   - Claude API key (required)');
        console.log('   - ElevenLabs API key (required for voice)');
        console.log('3. Start the server: npm run dev');
        console.log('\n🎥 Interviews will now use the built-in WebRTC video system!');
        console.log('No Google Meet configuration needed.\n');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

enableWebRTCMode();