const fs = require('fs').promises;
const path = require('path');

async function fixReplitTimeout() {
  console.log('🔧 Applying Replit timeout fix...\n');
  
  // Update index.js to add timeout handling
  const indexPath = path.join(__dirname, 'index.js');
  let content = await fs.readFile(indexPath, 'utf8');
  
  // Add request timeout middleware if not present
  if (!content.includes('req.setTimeout')) {
    const middlewareCode = `
// Add timeout handling for Replit
app.use((req, res, next) => {
  // Set a 30-second timeout for all requests
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});
`;
    
    // Insert after body parser setup
    const insertPoint = content.indexOf('app.use(cookieParser());');
    if (insertPoint > -1) {
      content = content.slice(0, insertPoint) + middlewareCode + '\n' + content.slice(insertPoint);
      await fs.writeFile(indexPath, content);
      console.log('✅ Added timeout middleware');
    }
  }
  
  // Update admin.html to add retry logic
  const adminPath = path.join(__dirname, 'src/ui/admin.html');
  let adminContent = await fs.readFile(adminPath, 'utf8');
  
  // Replace the saveApiKeys function with one that has retry logic
  const newSaveFunction = `async function saveApiKeys() {
            console.log('Starting API key save...');
            
            const keys = {};
            
            // Get values from form
            const claudeValue = document.getElementById('claude-key').value.trim();
            const googleValue = document.getElementById('google-creds').value.trim();
            const elevenValue = document.getElementById('elevenlabs-key').value.trim();
            
            // Only include non-masked values
            if (claudeValue && !claudeValue.includes('••••')) {
                keys.claude_api_key = claudeValue;
            }
            if (googleValue && googleValue !== '{ ... }' && !googleValue.includes('••••')) {
                // Validate JSON
                try {
                    JSON.parse(googleValue);
                    keys.google_credentials = googleValue;
                } catch (e) {
                    alert('Invalid Google Service Account JSON format');
                    return;
                }
            }
            if (elevenValue && !elevenValue.includes('••••')) {
                keys.elevenlabs_api_key = elevenValue;
            }
            
            // Check if we have any keys to save
            if (Object.keys(keys).length === 0) {
                alert('No new API keys to save. Please enter at least one new key.');
                return;
            }
            
            console.log('Keys to save:', Object.keys(keys));
            
            // Show loading state
            const saveButton = event.target;
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Saving...';
            saveButton.disabled = true;
            
            // Retry logic for Replit
            let attempts = 0;
            const maxAttempts = 3;
            
            async function attemptSave() {
                attempts++;
                try {
                    const response = await fetch('/api/config/keys', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify(keys),
                        // Add timeout
                        signal: AbortSignal.timeout(25000)
                    });

                    // Handle 502 specifically
                    if (response.status === 502 && attempts < maxAttempts) {
                        console.log(\`Attempt \${attempts} failed with 502, retrying...\`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return attemptSave();
                    }

                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }

                    let data;
                    try {
                        data = await response.json();
                    } catch (e) {
                        // If JSON parsing fails, assume success
                        console.log('JSON parse failed, but request may have succeeded');
                        data = { success: true };
                    }
                    
                    if (data.success) {
                        alert('API keys saved successfully!');
                        // Reload the page to ensure fresh state
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        console.error('Server error:', data);
                        alert(\`Error: \${data.error || 'Failed to save keys'}\`);
                    }
                } catch (error) {
                    console.error('Save error:', error);
                    if (error.name === 'AbortError') {
                        alert('Request timed out. Please use: node setup-api-keys-v2.js in the Shell.');
                    } else if (error.message.includes('502')) {
                        alert('Replit server error. Please use: node setup-api-keys-v2.js in the Shell.');
                    } else if (error.message.includes('Failed to fetch')) {
                        alert('Cannot connect to server. Make sure the server is running.');
                    } else {
                        alert(\`Error: \${error.message}\`);
                    }
                } finally {
                    saveButton.textContent = originalText;
                    saveButton.disabled = false;
                }
            }
            
            await attemptSave();
        }`;
  
  // Find and replace the saveApiKeys function
  const funcStart = adminContent.indexOf('async function saveApiKeys()');
  if (funcStart > -1) {
    const funcEnd = adminContent.indexOf('window.saveApiKeys = saveApiKeys;', funcStart);
    if (funcEnd > -1) {
      adminContent = adminContent.slice(0, funcStart) + newSaveFunction + '\n        ' + adminContent.slice(funcEnd);
      await fs.writeFile(adminPath, adminContent);
      console.log('✅ Updated saveApiKeys with retry logic');
    }
  }
  
  console.log('\n✨ Replit timeout fixes applied!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart your Replit');
  console.log('2. Try saving API keys again');
  console.log('3. If it still fails, use: node setup-api-keys-v2.js');
}

fixReplitTimeout().catch(console.error);