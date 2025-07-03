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

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize config first
const configManager = new ConfigManager();

// Initialize services after config
let interviewAI, evaluator, meetGenerator, driveUploader;

async function initializeServices() {
  await configManager.initialize();
  await ServiceInitializer.initializeAllServices(configManager);
  
  interviewAI = new InterviewAI();
  evaluator = new Evaluator();
  meetGenerator = new MeetGenerator();
  driveUploader = new DriveUploader();
}

// Initialize admin user
AuthMiddleware.initializeAdmin();

// Start initialization
initializeServices().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('src/ui'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'interview-platform-secret',
  resave: false,
  saveUninitialized: true
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
  res.sendFile(path.join(__dirname, 'src/ui/interview.html'));
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
    const keys = req.body;
    
    for (const [key, value] of Object.entries(keys)) {
      if (value && !value.includes('••••')) {
        const keyName = key.toUpperCase().replace(/-/g, '_');
        await configManager.setApiKey(keyName, value);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Webhook endpoint for Recall.ai
app.post('/api/webhooks/recall', async (req, res) => {
  try {
    console.log('Recall webhook received:', req.body.event);
    
    const recallService = meetGenerator.recallService;
    await recallService.processWebhook(req.body);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Serve uploaded files (for local storage)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));

app.listen(PORT, () => {
  console.log(`Interview platform running on http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/login`);
});