const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class GoogleMeetBot extends EventEmitter {
  constructor(options = {}) {
    super();
    this.meetUrl = options.meetUrl;
    this.botName = options.botName || 'AI Interviewer';
    this.browser = null;
    this.page = null;
    this.isInMeeting = false;
    this.audioQueue = [];
    this.isPlaying = false;
  }

  async launch() {
    try {
      console.log('🤖 Launching AI Interview Bot...');
      
      // Launch browser with specific args for audio/video
      this.browser = await puppeteer.launch({
        headless: false, // Must be false for audio/video
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--auto-accept-camera-and-microphone-capture',
          '--enable-usermedia-screen-capturing',
          '--allow-running-insecure-content',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,720',
          '--start-maximized'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      });

      this.page = await this.browser.newPage();
      
      // Set up console logging
      this.page.on('console', msg => {
        console.log('Browser console:', msg.text());
      });

      // Navigate to Google Meet
      console.log('📍 Navigating to:', this.meetUrl);
      await this.page.goto(this.meetUrl, { waitUntil: 'networkidle2' });
      
      // Wait a bit for page to load
      await this.page.waitForTimeout(3000);
      
      // Try to dismiss any popups
      await this.dismissPopups();
      
      // Enter bot name
      await this.enterBotName();
      
      // Join the meeting
      await this.joinMeeting();
      
      // Set up audio context for playing ElevenLabs audio
      await this.setupAudioContext();
      
      this.emit('ready');
      console.log('✅ Bot is ready!');
      
      return true;
    } catch (error) {
      console.error('❌ Error launching bot:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async dismissPopups() {
    try {
      // Try to click "Got it" or similar dismissal buttons
      const dismissButtons = [
        'button[aria-label="Got it"]',
        'button[aria-label="Dismiss"]',
        'button:has-text("Got it")',
        'button:has-text("OK")'
      ];
      
      for (const selector of dismissButtons) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          console.log('Dismissed popup');
        } catch (e) {
          // Popup might not exist, that's ok
        }
      }
    } catch (error) {
      console.log('No popups to dismiss');
    }
  }

  async enterBotName() {
    try {
      // Wait for name input field
      const nameInputSelectors = [
        'input[placeholder="Your name"]',
        'input[aria-label="Your name"]',
        'input[type="text"]'
      ];
      
      for (const selector of nameInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.click(selector);
          await this.page.keyboard.type(this.botName);
          console.log('✅ Entered bot name');
          return;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('Could not enter name:', error);
    }
  }

  async joinMeeting() {
    try {
      // Turn off camera and microphone before joining
      await this.toggleCamera(false);
      await this.toggleMicrophone(false);
      
      // Wait a bit
      await this.page.waitForTimeout(2000);
      
      // Click join button
      const joinButtonSelectors = [
        'button[jsname="Qx7uuf"]',
        'button:has-text("Join now")',
        'button:has-text("Ask to join")',
        'button[aria-label="Join now"]',
        'button[data-mdc-dialog-action="m3c5"]'
      ];
      
      for (const selector of joinButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.click(selector);
          console.log('✅ Clicked join button');
          this.isInMeeting = true;
          this.emit('joined');
          return;
        } catch (e) {
          continue;
        }
      }
      
      throw new Error('Could not find join button');
    } catch (error) {
      console.error('Error joining meeting:', error);
      throw error;
    }
  }

  async toggleCamera(enable = false) {
    try {
      const cameraButtonSelectors = [
        'button[aria-label*="camera"]',
        'button[aria-label*="Camera"]',
        'button[data-is-muted="false"][aria-label*="camera"]'
      ];
      
      for (const selector of cameraButtonSelectors) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          console.log(`Camera ${enable ? 'enabled' : 'disabled'}`);
          return;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log('Could not toggle camera');
    }
  }

  async toggleMicrophone(enable = false) {
    try {
      const micButtonSelectors = [
        'button[aria-label*="microphone"]',
        'button[aria-label*="Microphone"]',
        'button[data-is-muted="false"][aria-label*="microphone"]'
      ];
      
      for (const selector of micButtonSelectors) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          console.log(`Microphone ${enable ? 'enabled' : 'disabled'}`);
          return;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log('Could not toggle microphone');
    }
  }

  async setupAudioContext() {
    // Inject audio playing capabilities into the page
    await this.page.evaluate(() => {
      window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      window.audioQueue = [];
      
      window.playAudioFromUrl = async (url) => {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
          
          const source = window.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(window.audioContext.destination);
          
          return new Promise((resolve) => {
            source.onended = resolve;
            source.start();
          });
        } catch (error) {
          console.error('Error playing audio:', error);
        }
      };
    });
  }

  async playAudio(audioUrl) {
    if (!this.isInMeeting) {
      console.warn('Not in meeting yet, cannot play audio');
      return;
    }
    
    try {
      console.log('🔊 Playing audio:', audioUrl);
      
      // Convert relative URL to absolute
      const absoluteUrl = audioUrl.startsWith('http') 
        ? audioUrl 
        : `http://localhost:${process.env.PORT || 3000}${audioUrl}`;
      
      // Play audio in the browser context
      await this.page.evaluate(async (url) => {
        await window.playAudioFromUrl(url);
      }, absoluteUrl);
      
      console.log('✅ Audio playback complete');
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async sendChatMessage(message) {
    try {
      // Open chat if not already open
      const chatButtonSelectors = [
        'button[aria-label*="Chat"]',
        'button[aria-label="Chat with everyone"]'
      ];
      
      for (const selector of chatButtonSelectors) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          break;
        } catch (e) {
          continue;
        }
      }
      
      // Wait for chat to open
      await this.page.waitForTimeout(1000);
      
      // Find chat input
      const chatInputSelectors = [
        'textarea[aria-label*="Send a message"]',
        'input[aria-label*="Send a message"]',
        'textarea[placeholder*="Send a message"]'
      ];
      
      for (const selector of chatInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          await this.page.click(selector);
          await this.page.keyboard.type(message);
          await this.page.keyboard.press('Enter');
          console.log('📝 Sent chat message');
          return;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('Could not send chat message:', error);
    }
  }

  async captureTranscript() {
    // In a real implementation, this would capture live captions
    // For now, we'll use a simpler approach
    return null;
  }

  async leaveMeeting() {
    try {
      console.log('👋 Leaving meeting...');
      
      // Click leave button
      const leaveButtonSelectors = [
        'button[aria-label="Leave call"]',
        'button[aria-label="Leave meeting"]',
        'button[jsname="CQylAd"]'
      ];
      
      for (const selector of leaveButtonSelectors) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          console.log('Clicked leave button');
          break;
        } catch (e) {
          continue;
        }
      }
      
      // Confirm leave if needed
      await this.page.waitForTimeout(1000);
      
      const confirmSelectors = [
        'button:has-text("Leave")',
        'button:has-text("End")',
        'button[jsname="V67aGc"]'
      ];
      
      for (const selector of confirmSelectors) {
        try {
          await this.page.click(selector, { timeout: 2000 });
          break;
        } catch (e) {
          continue;
        }
      }
      
      this.isInMeeting = false;
      this.emit('left');
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  async takeScreenshot(filename = 'meet-screenshot.png') {
    if (this.page) {
      const screenshotPath = path.join(__dirname, '../../temp', filename);
      await this.page.screenshot({ path: screenshotPath });
      console.log('📸 Screenshot saved:', screenshotPath);
      return screenshotPath;
    }
  }
}

module.exports = GoogleMeetBot;