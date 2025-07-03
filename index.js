require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const cookieParser = require('cookie-parser');
const InterviewAI = require('./src/logic/interview_ai');
const Evaluator = require('./src/logic/evaluator');
const MeetGenerator = require('./src/utils/meet_generator');
const DriveUploader = require('./src/utils/drive_upload');
const AuthMiddleware = require('./src/middleware/auth');
const ConfigManager = require('./src/utils/config_manager');
const ServiceInitializer = require('./src/utils/service_initializer');
const AutomatedInterviewSystem = require('./src/logic/automated_interview_system');
const ManualInterviewOrchestrator = require('./src/logic/manual_interview_orchestrator');
const SelfHostedInterviewOrchestrator = require('./src/logic/self_hosted_interview_orchestrator');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize config first
const configManager = new ConfigManager();

// Initialize services after config
let interviewAI, evaluator, meetGenerator, driveUploader, automatedInterviewSystem, manualInterviewOrchestrator, selfHostedInterviewOrchestrator;
async function initializeServices() {
  await configManager.initialize();
  await ServiceInitializer.initializeAllServices(configManager);
  
  interviewAI = new InterviewAI();
  evaluator = new Evaluator();
  meetGenerator = new MeetGenerator();
  driveUploader = new DriveUploader();
  automatedInterviewSystem = new AutomatedInterviewSystem();
    manualInterviewOrchestrator = new ManualInterviewOrchestrator();
  selfHostedInterviewOrchestrator = new SelfHostedInterviewOrchestrator();
}

// Initialize admin user
AuthMiddleware.initializeAdmin();

// Start initialization
initializeServices().catch(console.error);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('src/ui'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'interview-platform-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Simple middleware - just check authentication for protected routes
app.use((req, res, next) => {
  // No initialization checks - let admin decide when to configure
  next();
});

// Routes
app.get('/', (req, res) => {
  // Redirect to login as the main entry point
  res.redirect('/login');
});

app.get('/setup', async (req, res) => {
  const isInitialized = await configManager.isInitialized();
  if (isInitialized) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'src/ui/setup.html'));
});

app.get('/interview', (req, res) => {
  // Redirect to landing page - we don't use text-based interviews anymore
  res.redirect('/candidate');
});

app.get('/candidate', (req, res) => {
  // This is the actual candidate-facing interview page
  res.sendFile(path.join(__dirname, 'src/ui/landing.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/ui/login.html'));
});

app.get('/admin', AuthMiddleware.requireAdmin, (req, res) => {
  // Let admin access dashboard directly - they can configure API keys from there
  res.sendFile(path.join(__dirname, 'src/ui/admin.html'));
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check credentials against fixed admin account
    const adminUser = await AuthMiddleware.initializeAdmin();
    
    if (email !== adminUser.email && email !== adminUser.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await AuthMiddleware.comparePassword(password, adminUser.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = AuthMiddleware.generateToken({
      email: adminUser.email,
      role: adminUser.role
    });
    
    // Set httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ success: true, role: 'admin' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true });
});

app.get('/api/auth/check', AuthMiddleware.requireAuth, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// Configuration API Routes
app.post('/api/config/test', async (req, res) => {
  try {
    const { service, apiKey } = req.body;
    const result = await configManager.testApiKey(service, apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/config/status', async (req, res) => {
  try {
    const SystemCheck = require('./src/utils/system_check');
    const status = await SystemCheck.checkAllServices();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/complete-setup', async (req, res) => {
  try {
    const config = req.body;
    
    // Save settings
    await configManager.updateSettings({
      company_name: config.company_name,
      platform_name: config.platform_name,
      intro_content: config.intro_content
    });
    
    // Save API keys
    if (config.claude_api_key) {
      await configManager.setApiKey('CLAUDE_API_KEY', config.claude_api_key);
    }
    if (config.google_credentials) {
      await configManager.setApiKey('GOOGLE_CREDENTIALS', config.google_credentials);
    }
    if (config.elevenlabs_api_key) {
      await configManager.setApiKey('ELEVENLABS_API_KEY', config.elevenlabs_api_key);
    }
    if (config.recall_api_key) {
      await configManager.setApiKey('RECALL_API_KEY', config.recall_api_key);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config/keys', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const keys = await configManager.getApiKeys();
    // Mask sensitive parts
    const masked = {};
    for (const [key, value] of Object.entries(keys)) {
      if (value && value.length > 8) {
        masked[key] = value.substr(-4);
      }
    }
    res.json(masked);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/keys', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    console.log('API Save Request:');
    console.log('- User:', req.user);
    console.log('- Body keys:', Object.keys(req.body));
    
    const keys = req.body;
    
    if (!keys || Object.keys(keys).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No keys provided' 
      });
    }
    
    // Ensure config manager is initialized
    await configManager.initialize();
    
    // Save each key
    const saved = [];
    const errors = [];
    
    for (const [key, value] of Object.entries(keys)) {
      if (value && typeof value === 'string' && value.trim()) {
        try {
          const keyName = key.toUpperCase().replace(/-/g, '_');
          await configManager.setApiKey(keyName, value.trim());
          saved.push(keyName);
          console.log(`✅ Saved: ${keyName}`);
        } catch (err) {
          errors.push(`${key}: ${err.message}`);
          console.error(`❌ Failed to save ${key}:`, err);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'Some keys failed to save', 
        details: errors 
      });
    }
    
    // Re-initialize services with new keys
    await ServiceInitializer.initializeAllServices(configManager);
    
    console.log(`✅ Saved ${saved.length} API keys successfully`);
    res.json({ success: true, saved: saved });
  } catch (error) {
    console.error('❌ API Save Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// API Routes
app.get('/api/settings', async (req, res) => {
  try {
    const config = await configManager.getConfig();
    res.json(config.settings || { intro_content: '# Welcome to Your Interview\n\nWe are excited to meet you!' });
  } catch (error) {
    res.json({ intro_content: '# Welcome to Your Interview\n\nWe are excited to meet you!' });
  }
});

app.post('/api/settings', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    await configManager.updateSettings(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/roles', async (req, res) => {
  try {
    const files = await fs.readdir('src/roles');
    const roles = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(`src/roles/${file}`, 'utf8');
        roles.push(JSON.parse(content));
      }
    }
    res.json(roles);
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/roles', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const filename = req.body.role.toLowerCase().replace(/\s+/g, '_') + '.json';
    await fs.writeFile(`src/roles/${filename}`, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/roles/:roleName', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const filename = req.params.roleName.toLowerCase().replace(/\s+/g, '_') + '.json';
    await fs.unlink(`src/roles/${filename}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Results API
app.get('/api/results', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, 'data/results.json');
    const content = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(content);
    
    // Filter by role if specified
    const role = req.query.role;
    if (role) {
      return res.json(results.filter(r => r.role === role));
    }
    
    res.json(results);
  } catch (error) {
    res.json([]);
  }
});

app.get('/api/results/:id', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, 'data/results.json');
    const content = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(content);
    const result = results.find(r => r.id === req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Interview API Routes
app.post('/api/meet/create', async (req, res) => {
  try {
    const { role, candidateId } = req.body;
    const meetInfo = await meetGenerator.createMeetRoom(candidateId, 'Candidate', role);
    res.json(meetInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interview/start', async (req, res) => {
  try {
    const { role, candidateId, meetUrl } = req.body;
    
    // Load role template
    const roleTemplate = await interviewAI.loadRoleTemplate(role);
    
    // Start interview process (in production, this would be more complex)
    const interviewSession = {
      sessionId: candidateId,
      role,
      meetUrl,
      startedAt: new Date().toISOString(),
      status: 'in_progress'
    };
    
    res.json(interviewSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interview/end', async (req, res) => {
  try {
    const { candidateId } = req.body;
    
    // Mark interview as completed
    const result = {
      candidateId,
      endedAt: new Date().toISOString(),
      status: 'completed'
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interview/evaluate', async (req, res) => {
  try {
    const { candidateId, role } = req.body;
    
    // Load role template
    const roleTemplate = await interviewAI.loadRoleTemplate(role);
    
    // For demo purposes, create mock interview data
    const mockInterviewData = {
      sessionId: candidateId,
      candidateName: 'Demo Candidate',
      responses: [
        {
          question: roleTemplate.questions[0],
          response: 'This is a demo response showing how the system would capture and evaluate real interview answers.',
          timestamp: new Date().toISOString()
        }
      ]
    };
    
    // Evaluate the interview
    const evaluation = await evaluator.evaluateInterview(mockInterviewData, roleTemplate);
    
    res.json(evaluation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/interviews', async (req, res) => {
  try {
    const content = await fs.readFile('data/interviews.json', 'utf8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.json([]);
  }
});

app.get('/api/interviews/:uuid', async (req, res) => {
  try {
    const reportPath = path.join(__dirname, 'src/reports', `${req.params.uuid}.json`);
    const content = await fs.readFile(reportPath, 'utf8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(404).json({ error: 'Interview not found' });
  }
});

// Automated Interview API Routes
app.post('/api/interview/automated/start', async (req, res) => {
  try {
    const { candidateName, email, role } = req.body;
    
    console.log('Interview start request:', { candidateName, email, role });
    
    // Validate input
    if (!candidateName || !email || !role) {
      return res.status(400).json({ 
        error: 'Please provide candidate name, email, and role' 
      });
    }
    
    // Ensure services are initialized
    await configManager.initialize();
    
    // Check API keys from ConfigManager
    const apiKeys = await configManager.getApiKeys();
    const hasElevenLabs = !!apiKeys.ELEVENLABS_API_KEY;
    const hasGoogleCreds = !!apiKeys.GOOGLE_CREDENTIALS;
    const hasClaude = !!apiKeys.CLAUDE_API_KEY;
    
    console.log('API key status:', {
      claude: hasClaude,
      google: hasGoogleCreds,
      elevenlabs: hasElevenLabs
    });
    
    if (!hasClaude || !hasGoogleCreds || !hasElevenLabs) {
      const missing = [];
      if (!hasClaude) missing.push('Claude AI');
      if (!hasGoogleCreds) missing.push('Google Services');
      if (!hasElevenLabs) missing.push('ElevenLabs');
      
      return res.status(400).json({ 
        error: `Missing required API keys: ${missing.join(', ')}. Please configure them in the admin panel.`
      });
    }
    
    // Ensure services are initialized with latest keys
    await ServiceInitializer.initializeAllServices(configManager);
    
    const roleSlug = role.toLowerCase().replace(/\s+/g, '_');
    
    try {
      // Always use self-hosted bot mode
      console.log('Starting interview with self-hosted bot mode');
      const result = await selfHostedInterviewOrchestrator.startVideoInterview(
        candidateName,
        email,
        roleSlug
      );
      
      console.log('Interview started successfully:', result.sessionId);
      
      res.json({
        id: result.sessionId,
        meetUrl: result.meetUrl,
        instructions: result.instructions,
        status: 'ready',
        mode: 'self-hosted-bot'
      });
      
    } catch (innerError) {
      console.error('Interview orchestration error:', innerError);
      
      // Fallback to manual mode if bot fails
      console.log('Falling back to manual interview mode');
      const result = await manualInterviewOrchestrator.startVideoInterview(
        candidateName,
        email,
        roleSlug
      );
      
      res.json({
        id: result.sessionId,
        meetUrl: result.meetUrl,
        instructions: result.instructions,
        interviewGuideUrl: result.interviewGuideUrl,
        status: 'ready',
        mode: 'manual',
        notice: 'AI bot unavailable - manual interview mode activated'
      });
    }
    
  } catch (error) {
    console.error('❌ Interview start error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: `Failed to start interview: ${error.message}` 
    });
  }
});

app.get('/api/interview/automated/session/:sessionId', async (req, res) => {
  try {
    const session = automatedInterviewSystem.getActiveSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      id: session.id,
      role: session.role,
      status: session.status,
      totalQuestions: session.questions ? session.questions.length : 0,
      currentQuestion: session.currentQuestionIndex
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/interview/automated/next-question/:sessionId', async (req, res) => {
  try {
    const question = await automatedInterviewSystem.getNextQuestion(req.params.sessionId);
    if (!question) {
      return res.json(null);
    }
    
    res.json({
      text: question.text,
      type: question.type,
      audioUrl: question.audioUrl ? `/api/audio/${path.basename(question.audioUrl)}` : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interview/automated/submit-answer', async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    const success = await automatedInterviewSystem.submitAnswer(sessionId, answer);
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to submit answer' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve audio files
app.get('/api/audio/:filename', (req, res) => {
  const audioPath = path.join(__dirname, 'temp', req.params.filename);
  if (require('fs').existsSync(audioPath)) {
    res.sendFile(audioPath);
  } else {
    res.status(404).send('Audio not found');
  }
});

// Serve interview guide for manual interviews
app.get('/api/interview/guide/:sessionId', async (req, res) => {
  try {
    const guide = await manualInterviewOrchestrator.getInterviewGuide(req.params.sessionId);
    if (!guide) {
      return res.status(404).json({ error: 'Interview guide not found' });
    }
    
    // Return as HTML for easy viewing
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Interview Guide - ${guide.role}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #333; }
          .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .question { margin: 15px 0; padding: 10px; background: white; border-left: 4px solid #007bff; }
          .notes { color: #666; font-style: italic; margin-top: 5px; }
          .time { color: #28a745; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Interview Guide: ${guide.role}</h1>
        
        <div class="section">
          <h2>Job Description</h2>
          <p>${guide.jobDescription}</p>
        </div>
        
        <div class="section">
          <h2>Interview Structure</h2>
          ${guide.interviewStructure.sections.map(s => 
            `<div><span class="time">${s.time}</span> - ${s.name}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <h2>Questions</h2>
          ${guide.questions.map((q, i) => `
            <div class="question">
              <strong>Q${i + 1}: ${q.text}</strong>
              <div class="notes">${q.notes}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="section">
          <h2>Scoring Guide</h2>
          ${Object.entries(guide.scoringGuide).map(([level, desc]) => 
            `<div><strong>${level}:</strong> ${desc}</div>`
          ).join('')}
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Serve uploaded files (for local storage)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));

app.listen(PORT, () => {
  console.log(`Interview platform running on http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/login`);
});