# Replit Quick Start Guide

## If You're Getting Configuration Errors:

### Option 1: Manual Configuration (Recommended)
1. In Replit, click the "⚙️ Configuration" button (or go to Tools → Settings)
2. Set the Run command to: `node server.js`
3. Save the configuration

### Option 2: Use Shell Commands
Instead of clicking "Run", use the Shell tab:

```bash
# First time setup:
npm install
node simple-setup.js

# To start the platform:
node server.js
```

## Complete Setup Instructions:

1. **In the Shell tab (not Console), run:**
   ```bash
   npm install
   ```

2. **Setup your API keys:**
   ```bash
   node simple-setup.js
   ```
   - Enter Claude API key when prompted
   - Enter ElevenLabs API key (or press Enter to skip)

3. **Start the platform:**
   ```bash
   node server.js
   ```

4. **Your app is now running!**
   - Look for the URL in the Webview panel
   - Share this URL with your HR team

## If Still Having Issues:

1. **Delete these files and try again:**
   - `.replit`
   - `replit.nix`

2. **Use the Shell directly:**
   ```bash
   # Install dependencies
   npm install

   # Run setup
   node simple-setup.js

   # Start server
   node server.js
   ```

3. **Configure manually in Replit:**
   - Go to the Configuration pane
   - Set Run command: `node server.js`
   - Set Language: Node.js

## That's it! Your AI Interview Platform should now be running.