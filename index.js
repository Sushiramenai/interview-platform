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

// Detect Replit environment
const IS_REPLIT = !!(process.env.REPL_SLUG && process.env.REPL_OWNER);
if (IS_REPLIT) {
  console.log('🚀 Running on Replit - applying optimizations');
}

// Initialize config first
const configManager = new ConfigManager();

// Initialize services after config
let interviewAI, evaluator, meetGenerator, driveUploader, automatedInterviewSystem, manualInterviewOrchestrator, selfHostedInterviewOrchestrator;
let servicesInitialized = false;

async function initializeServices() {
  console.log('🔄 Initializing services...');
  
  try {
    await configManager.initialize();
    
    // Load and set API keys in environment
    const apiKeys = await configManager.getApiKeys();
    console.log('📦 Loaded API keys:', {
      claude: !!apiKeys.CLAUDE_API_KEY,
      google: !!apiKeys.GOOGLE_CREDENTIALS,
      elevenlabs: !!apiKeys.ELEVENLABS_API_KEY
    });
    
    await ServiceInitializer.initializeAllServices(configManager);
    
    // Create service instances AFTER environment is set up
    interviewAI = new InterviewAI();
    evaluator = new Evaluator();
    meetGenerator = new MeetGenerator();
    driveUploader = new DriveUploader();
    automatedInterviewSystem = new AutomatedInterviewSystem();
    manualInterviewOrchestrator = new ManualInterviewOrchestrator();
    selfHostedInterviewOrchestrator = new SelfHostedInterviewOrchestrator();
    
    servicesInitialized = true;
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization error:', error);
    throw error;
  }
}

// Initialize admin user
AuthMiddleware.initializeAdmin();

// Start initialization and track completion
let servicesReady = false;
initializeServices()
  .then(() => {
    servicesReady = true;
    servicesInitialized = true;
  })
  .catch(error => {
    console.error('❌ Service initialization failed:', error);
    servicesReady = false;
    servicesInitialized = false;
  });

// Middleware
// Trust proxy for Replit and other platforms
app.set('trust proxy', true);

// Add timeout handling for Replit
if (IS_REPLIT) {
  app.use((req, res, next) => {
    // Set a 30-second timeout for all requests on Replit
    req.setTimeout(30000);
    res.setTimeout(30000);
    next();
  });
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow all origins in Replit
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200
}));

// Add body parser limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Remove the duplicate express.json() call
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

// Health check for Replit
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// System status check
// Debug endpoint to check saved keys
app.get('/api/config/debug', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'data/config.json');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    
    let configContent = null;
    if (configExists) {
      configContent = await fs.readFile(configPath, 'utf8');
    }
    
    const verification = await configManager.verifyApiKeys();
    const apiKeys = await configManager.getApiKeys();
    
    res.json({
      configExists,
      configPath,
      verification,
      hasKeys: {
        claude: !!apiKeys.CLAUDE_API_KEY,
        google: !!apiKeys.GOOGLE_CREDENTIALS,
        elevenlabs: !!apiKeys.ELEVENLABS_API_KEY
      },
      configSize: configContent ? configContent.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/status', async (req, res) => {
  const apiKeys = await configManager.getApiKeys();
  
  res.json({
    servicesInitialized,
    servicesReady,
    apiKeys: {
      claude: !!apiKeys.CLAUDE_API_KEY,
      google: !!apiKeys.GOOGLE_CREDENTIALS,
      elevenlabs: !!apiKeys.ELEVENLABS_API_KEY
    },
    environment: {
      claude: !!process.env.CLAUDE_API_KEY,
      google: !!process.env.GOOGLE_CREDENTIALS,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY
    },
    orchestrators: {
      selfHosted: !!selfHostedInterviewOrchestrator,
      manual: !!manualInterviewOrchestrator
    }
  });
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
  // Set timeout for Replit
  if (IS_REPLIT) {
    req.setTimeout(15000);
    res.setTimeout(15000);
  }
  
  try {
    const { service, apiKey } = req.body;
    
    console.log(`Testing ${service} API connection...`);
    
    if (!service || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Service and API key are required' 
      });
    }
    
    // Ensure config manager is initialized
    if (!configManager) {
      await initializeServices();
    }
    
    // Add timeout protection for API tests on Replit
    if (IS_REPLIT) {
      const testPromise = configManager.testApiKey(service, apiKey);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), 12000)
      );
      
      try {
        const result = await Promise.race([testPromise, timeoutPromise]);
        res.json(result);
      } catch (timeoutError) {
        if (timeoutError.message === 'Test timeout') {
          res.json({ 
            success: false, 
            message: 'API test timed out. This might be due to network restrictions. Please try saving the key and testing the full system instead.' 
          });
        } else {
          throw timeoutError;
        }
      }
    } else {
      const result = await configManager.testApiKey(service, apiKey);
      res.json(result);
    }
  } catch (error) {
    console.error(`API test error for ${req.body?.service}:`, error);
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

// Check if specific keys are saved
app.get('/api/config/keys/status', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const keys = await configManager.getApiKeys();
    const status = {
      claude: !!keys.CLAUDE_API_KEY,
      google: !!keys.GOOGLE_CREDENTIALS,
      elevenlabs: !!keys.ELEVENLABS_API_KEY,
      timestamp: new Date().toISOString()
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct save endpoint for individual API keys - minimal processing
app.post('/api/config/key-direct', AuthMiddleware.requireAdmin, async (req, res) => {
  console.log('Direct API key save');
  
  try {
    const { keyName, keyValue } = req.body;
    
    if (!keyName || !keyValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Key name and value required' 
      });
    }
    
    console.log(`Direct saving ${keyName}`);
    
    // Direct save to file without complex processing
    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join(__dirname, 'data/config.json');
    
    // Read existing config
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Save key as plain text temporarily
    if (!config.apiKeys) {
      config.apiKeys = {};
    }
    config.apiKeys[`${keyName}_TEMP`] = keyValue;
    
    // Write back immediately
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    // Process properly in background
    setImmediate(async () => {
      try {
        console.log(`Background processing ${keyName}...`);
        await configManager.setApiKey(keyName, keyValue);
        
        // Remove temp key
        const updatedConfig = await configManager.getConfig();
        delete updatedConfig.apiKeys[`${keyName}_TEMP`];
        await configManager.saveConfig(updatedConfig);
        
        console.log(`✅ ${keyName} fully processed`);
      } catch (e) {
        console.error('Background processing failed:', e);
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Direct save error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Save failed' 
    });
  }
});

// Direct save endpoint for Google credentials - minimal processing
app.post('/api/config/google-direct', AuthMiddleware.requireAdmin, async (req, res) => {
  console.log('Direct Google credentials save');
  
  try {
    const { credentials } = req.body;
    
    if (!credentials) {
      return res.status(400).json({ 
        success: false, 
        error: 'Credentials required' 
      });
    }
    
    // Minimal validation
    try {
      JSON.parse(credentials);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON' 
      });
    }
    
    // Direct save to file without encryption (temporary)
    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join(__dirname, 'data/config.json');
    
    // Read existing config
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Save credentials as plain text temporarily
    if (!config.apiKeys) {
      config.apiKeys = {};
    }
    config.apiKeys.GOOGLE_CREDENTIALS_TEMP = credentials;
    
    // Write back immediately
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    // Now process properly in background
    setImmediate(async () => {
      try {
        console.log('Background processing Google credentials...');
        await configManager.setApiKey('GOOGLE_CREDENTIALS', credentials);
        
        // Remove temp key
        const updatedConfig = await configManager.getConfig();
        delete updatedConfig.apiKeys.GOOGLE_CREDENTIALS_TEMP;
        await configManager.saveConfig(updatedConfig);
        
        console.log('✅ Google credentials fully processed');
      } catch (e) {
        console.error('Background processing failed:', e);
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Direct save error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Save failed. Please use command line tool.' 
    });
  }
});

// Temporary storage for Google credential chunks
const googleCredsChunks = new Map();

// Endpoint to save Google credential chunks
app.post('/api/config/google-chunk', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const { chunkIndex, totalChunks, chunk } = req.body;
    const sessionId = req.sessionID || 'default';
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} chars)`);
    
    // Initialize storage for this session if needed
    if (!googleCredsChunks.has(sessionId)) {
      googleCredsChunks.set(sessionId, {
        chunks: new Array(totalChunks),
        timestamp: Date.now()
      });
    }
    
    // Store the chunk
    const session = googleCredsChunks.get(sessionId);
    session.chunks[chunkIndex] = chunk;
    
    res.json({ success: true, saved: chunkIndex + 1, total: totalChunks });
  } catch (error) {
    console.error('Chunk save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to finalize Google credentials from chunks
app.post('/api/config/google-finalize', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    const sessionId = req.sessionID || 'default';
    const session = googleCredsChunks.get(sessionId);
    
    if (!session || !session.chunks) {
      return res.status(400).json({ 
        success: false, 
        error: 'No chunks found. Please try again.' 
      });
    }
    
    // Reassemble the credentials
    const fullCredentials = session.chunks.join('');
    console.log(`Reassembled credentials: ${fullCredentials.length} chars`);
    
    // Validate JSON
    try {
      JSON.parse(fullCredentials);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON after reassembly' 
      });
    }
    
    // Save using ConfigManager with fast save option
    console.log('Saving reassembled Google credentials with fast save...');
    await configManager.setApiKey('GOOGLE_CREDENTIALS', fullCredentials, { fastSave: true });
    
    // Clean up chunks
    googleCredsChunks.delete(sessionId);
    
    console.log('✅ Google credentials saved successfully from chunks (encryption in progress)');
    res.json({ success: true });
    
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean up old chunks periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (const [sessionId, session] of googleCredsChunks.entries()) {
    if (now - session.timestamp > timeout) {
      googleCredsChunks.delete(sessionId);
      console.log(`Cleaned up expired chunks for session ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

// Special endpoint for Google credentials (kept for compatibility)
app.post('/api/config/google-creds', AuthMiddleware.requireAdmin, async (req, res) => {
  console.log('Google credentials save endpoint called');
  
  // Set long timeout for Google credentials
  req.setTimeout(45000); // 45 seconds
  res.setTimeout(45000);
  
  try {
    const { credentials } = req.body;
    
    if (!credentials) {
      return res.status(400).json({ 
        success: false, 
        error: 'Credentials required' 
      });
    }
    
    console.log(`Saving Google credentials: ${credentials.length} characters`);
    
    // Parse to validate JSON
    let parsed;
    try {
      parsed = JSON.parse(credentials);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON format' 
      });
    }
    
    // Ensure config manager is ready
    if (!configManager) {
      const ConfigManager = require('./src/utils/config_manager');
      configManager = new ConfigManager();
      await configManager.initialize();
    }
    
    // Save in chunks to avoid timeout
    console.log('Starting chunked save for Google credentials...');
    
    // First, save a placeholder
    await configManager.setApiKey('GOOGLE_CREDENTIALS_TEMP', 'pending');
    
    // Then save the actual credentials
    try {
      await configManager.setApiKey('GOOGLE_CREDENTIALS', credentials);
      
      // Clean up temp key
      const config = await configManager.getConfig();
      delete config.apiKeys.GOOGLE_CREDENTIALS_TEMP;
      await configManager.saveConfig(config);
      
      console.log('✅ Google credentials saved successfully');
      res.json({ success: true });
    } catch (saveError) {
      console.error('Failed to save Google credentials:', saveError);
      
      // Check if it was actually saved despite error
      const verification = await configManager.verifyApiKeys();
      if (verification.google) {
        console.log('✅ Google credentials were saved despite error');
        res.json({ success: true });
      } else {
        throw saveError;
      }
    }
    
  } catch (error) {
    console.error('❌ Google credentials save error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to save credentials'
    });
  }
});

// Convert base64 Google credentials back to normal format
app.post('/api/config/convert-google-creds', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    console.log('Converting Google credentials from base64...');
    
    const config = await configManager.getConfig();
    const base64Creds = config.apiKeys?.GOOGLE_CREDENTIALS_BASE64;
    
    if (base64Creds && base64Creds.startsWith('enc:')) {
      // Decrypt first
      const decrypted = configManager.decrypt(base64Creds.substring(4));
      if (decrypted) {
        // Decode from base64
        const jsonCreds = Buffer.from(decrypted, 'base64').toString('utf8');
        
        // Save as regular GOOGLE_CREDENTIALS
        await configManager.setApiKey('GOOGLE_CREDENTIALS', jsonCreds);
        
        // Remove the base64 version
        delete config.apiKeys.GOOGLE_CREDENTIALS_BASE64;
        await configManager.saveConfig(config);
        
        console.log('✅ Google credentials converted successfully');
        res.json({ success: true });
        return;
      }
    }
    
    res.json({ success: false, message: 'No base64 credentials found' });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save single API key endpoint for Replit
app.post('/api/config/key', AuthMiddleware.requireAdmin, async (req, res) => {
  console.log('Single key save endpoint called');
  
  // Set aggressive timeout for Replit
  req.setTimeout(30000); // 30 seconds for large keys
  res.setTimeout(30000);
  
  try {
    const { keyName, keyValue } = req.body;
    console.log(`Saving single key: ${keyName} (${keyValue ? keyValue.length : 0} chars)`);
    
    if (!keyName || !keyValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Key name and value required' 
      });
    }
    
    // Validate JSON for Google credentials
    if (keyName.toLowerCase().includes('google') && keyValue.trim().startsWith('{')) {
      try {
        JSON.parse(keyValue);
        console.log('✅ Valid Google credentials JSON');
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid JSON format for Google credentials' 
        });
      }
    }
    
    // Special handling for large values
    if (keyValue.length > 5000) {
      console.log(`Large key value detected: ${keyValue.length} characters (will be compressed)`);
    }
    
    // Ensure config manager is ready
    if (!configManager) {
      console.log('Creating new ConfigManager instance');
      const ConfigManager = require('./src/utils/config_manager');
      configManager = new ConfigManager();
    }
    
    await configManager.initialize();
    
    const normalizedKeyName = keyName.toUpperCase().replace(/-/g, '_');
    
    // Save with timeout protection - increased timeout for large keys
    const timeoutDuration = keyValue.length > 5000 ? 25000 : 20000;
    const savePromise = configManager.setApiKey(normalizedKeyName, keyValue.trim());
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Save timeout')), timeoutDuration)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
    
    console.log(`✅ Saved: ${normalizedKeyName}`);
    res.json({ success: true, saved: normalizedKeyName });
  } catch (error) {
    console.error('❌ Single key save error:', error);
    console.error('Stack:', error.stack);
    
    // Check if it's a timeout
    if (error.message === 'Save timeout') {
      // On timeout, check if the key was actually saved
      try {
        const verification = await configManager.verifyApiKeys();
        const keyMap = {
          'CLAUDE_API_KEY': 'claude',
          'GOOGLE_CREDENTIALS': 'google',
          'ELEVENLABS_API_KEY': 'elevenlabs'
        };
        
        const normalizedKeyName = keyName.toUpperCase().replace(/-/g, '_');
        if (verification[keyMap[normalizedKeyName]]) {
          console.log('✅ Key was saved despite timeout');
          return res.json({ success: true, saved: normalizedKeyName, note: 'Saved despite timeout' });
        }
      } catch (e) {
        console.error('Could not verify after timeout:', e);
      }
      
      res.status(504).json({ 
        success: false, 
        error: 'Request timeout - key may have been saved. Please refresh and check.',
        timeout: true
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal server error'
      });
    }
  }
});

// Original batch save endpoint (kept for compatibility)
app.post('/api/config/keys', AuthMiddleware.requireAdmin, async (req, res) => {
  try {
    console.log('API Save Request:');
    console.log('- User:', req.user);
    console.log('- Body keys:', Object.keys(req.body));
    console.log('- Environment: ', IS_REPLIT ? 'Replit' : 'Standard');
    
    const keys = req.body;
    
    if (!keys || Object.keys(keys).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No keys provided' 
      });
    }
    
    // On Replit with multiple keys, just log a warning but proceed
    if (IS_REPLIT && Object.keys(keys).length > 1) {
      console.log('⚠️  Multiple keys on Replit - may timeout, but will try anyway');
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
    // On Replit, do this asynchronously to avoid timeout
    if (IS_REPLIT) {
      console.log('📦 Deferring service initialization on Replit...');
      setTimeout(async () => {
        try {
          await ServiceInitializer.initializeAllServices(configManager);
          console.log('✅ Services initialized in background');
        } catch (err) {
          console.error('Background init error:', err);
        }
      }, 100);
    } else {
      await ServiceInitializer.initializeAllServices(configManager);
    }
    
    console.log(`✅ Saved ${saved.length} API keys successfully`);
    
    // Verify keys were actually saved
    const verification = await configManager.verifyApiKeys();
    console.log('Verification:', verification);
    
    if (verification.count === 0) {
      console.error('❌ Keys were not persisted to disk!');
      return res.status(500).json({ 
        success: false, 
        error: 'Keys were not saved to disk. Please try again.' 
      });
    }
    
    res.json({ success: true, saved: saved, verified: verification });
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
  console.log('\n🎯 Interview start request received');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  try {
    const { candidateName, email, role } = req.body;
    
    console.log('📋 Interview parameters:', { candidateName, email, role });
    
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
    
    // Also check environment variables after initialization
    console.log('Environment variables:', {
      CLAUDE_API_KEY: !!process.env.CLAUDE_API_KEY,
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
      GOOGLE_CREDENTIALS: !!process.env.GOOGLE_CREDENTIALS
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
    
    // Always reinitialize to ensure fresh state on Replit
    console.log('🔄 Ensuring services are initialized...');
    try {
      await initializeServices();
      console.log('✅ Services initialization complete');
    } catch (initError) {
      console.error('❌ Service initialization failed:', initError);
      throw new Error('Failed to initialize services: ' + initError.message);
    }
    
    // Verify API keys are in environment
    const requiredEnvVars = ['CLAUDE_API_KEY', 'ELEVENLABS_API_KEY', 'GOOGLE_CREDENTIALS'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing environment variables:', missingVars);
      throw new Error('Missing required configuration: ' + missingVars.join(', '));
    }
    
    try {
      // Always use self-hosted bot mode
      console.log('🤖 Starting interview with self-hosted bot mode');
      console.log('Orchestrator exists:', !!selfHostedInterviewOrchestrator);
      console.log('Orchestrator type:', typeof selfHostedInterviewOrchestrator);
      
      if (!selfHostedInterviewOrchestrator) {
        throw new Error('selfHostedInterviewOrchestrator is undefined');
      }
      
      console.log('📞 Calling orchestrator.startVideoInterview...');
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
    
    // More detailed error for debugging
    const errorDetails = {
      message: error.message,
      servicesInitialized: servicesReady,
      hasOrchestrators: !!selfHostedInterviewOrchestrator && !!manualInterviewOrchestrator,
      apiKeysSet: {
        claude: !!process.env.CLAUDE_API_KEY,
        elevenlabs: !!process.env.ELEVENLABS_API_KEY,
        google: !!process.env.GOOGLE_CREDENTIALS
      }
    };
    
    console.error('Error details:', errorDetails);
    
    res.status(500).json({ 
      error: error.message || 'Failed to start interview'
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Interview platform running on http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/login`);
});