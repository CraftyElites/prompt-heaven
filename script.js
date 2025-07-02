const APP_KEY = "dt6siumgqu22eag";
// Admin token will be set dynamically - replace with your admin token
let ADMIN_TOKEN = "sl.u.AF0k_m24VSCesXLr01KFHtMDGIKBfYoxpMyCcjDsXtHgw7cm749uI4AZXTBJn7w6R6BVfKA0TJ3oH0qqexOmnt9e4TGg0rdBELyye4EnZzpmsVwCYS6vDWDCUQgajdTnPgpXftZJWZEAquQtMJZ7SRXtzQhUc8lF8L_amu29Hy10edCkREmv914nm6lDEDicyHAOUgonLhGk1I8zQKY7Q4v4EGcR56u2FTwLfm3hWaMs4Psqkkeb2WtU2rKUvgr8PO2tvTlzBt4CfzUgUHfaGM8ge1R0IRG6Tu3P_EWTLu2QzyYzyMk2KHDaMbZXVwTeiY3M0cItyRr_wV-7inOWpLN8ncwDQIsM88y7XDb4c2Oq8onDLsfDZCNTMMezT8g3awUzvxhto2GEAkMAMZVHzVDcarHI3Yg33RNcMfrFOVaAZSXV0ovzW0YiX4AYm3K_l_LnWptNuFHyeiFFuSpWmXKlwwqY2caRKJ5onooHmP3C2NTABKRfn4vAvZhZgvX5IPTzd2qS8mA0_f1C6uVEMsadskp5Z4b-mEZsIsRNQky_fRJo2xIygo9rPzci7ZvVihAa1f2h3vcKTPvBLWCWSUuHyjnF04byNeobN98LkvV5Rfr7ErBwEeBrwc62e6D7XothkVTO4Qt_Bh5ljIIzm_ucKAU2NghIR0s_JAMCCkMZ83gU_1ugvPEbygnCE_wuzOe-80khr7hWaMuhbHSL9N50eJsfuaS3tiJio8ooQtjLwnoU0QbbAitctuRa3j2cHQHhgodwHePbrAJ9_cMhlVg1IvhL3ZDP12Tkk1GBJxtBL8xv9Ke1TsDSqWLEXM-wyzroXHIrHwsHPjWp7DQ7Ljxi44qZ3HfMbevdOBbMaNptvWNufCn9NAOZLfdnGMssBjXkeKPS3uECzHZ3Koa_rF3lfYS1ffNxYaIOZrWgk2cSnVZlA8kaCnj-QMleXhjFBVjXxkYlklLrYrKLvHOX897ABSfcd7HtEn6kLexQtDHh9kHXCv6-42yQCqGRwT1lEeQN8X7yVnqk7RI5ccMCjOCHknKl21dc4qFc-vbY-hY5Yvpg0IpIcPMe2ZmicTZx5nvPzQ68RXt2Ebepi81cU3Ub6N3IqxP3XfyyfONpjaDkcVLZ3bX9_8V1XRwb-R-9NUMhtqsM64qd6oWW0QEyAOHESMtETMcvnCVKpBcV7JTWFtglNg1m8skdIiEwLu4FUmMZfRMVOBHsmUkTaQaw9sei3iOqZe2-xVhvXMxl0jRDyJpzJN_FlCIr0MyFS45gqwAowAIRocYU83KQx7dloQKOO-dhkO-VFStjbBltFNZWU__3Bbic8UeNhEzBHdlHzIazUqWQQM0XAF-kFb3dMzr1-QiOW2LSNb82ijK3LKDBSIVYPSPaqxpT8fBAk7uvbKrNhIG3eZ8VyrESG_vnqYQyZRZzWT-6vCIukOdvNetosw"; // <-- Set your admin token here
const USER_FOLDER = "/prompt_heaven";
const LOGS_FOLDER = "/PromptHeavenLogs";

// Global state variables - keep it clean and lean
let dbxUser, userInfo;
let promptLogCache = [];
let logsLoaded = false;
let uploadInProgress = false;
let adminDbx = null;
let tokenRefreshInProgress = false;
let lastTokenRefresh = 0;

// Token refresh settings
const TOKEN_REFRESH_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const TOKEN_EXPIRY_BUFFER = 30 * 60 * 1000; // 30 minutes buffer before expiry

// Domain masking magic for that GitHub Pages aesthetic
if (location.hostname.includes("github.io")) {
  history.replaceState(null, null, "/prompt-heaven/");
}

// Initialize admin token and setup refresh mechanism
function initializeAdminToken() {
  if (!ADMIN_TOKEN) {
    console.error("❌ Admin token not configured. Please set ADMIN_TOKEN in the script.");
    return false;
  }
  
  adminDbx = new Dropbox.Dropbox({ accessToken: ADMIN_TOKEN });
  
  // Set up automatic token refresh
  setupTokenRefresh();
  
  return true;
}

// Setup automatic token refresh mechanism
function setupTokenRefresh() {
  // Check if token needs refresh on startup
  const now = Date.now();
  if (now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL) {
    scheduleTokenRefresh(5000); // Refresh after 5 seconds
  } else {
    // Schedule next refresh
    const nextRefresh = TOKEN_REFRESH_INTERVAL - (now - lastTokenRefresh);
    scheduleTokenRefresh(nextRefresh);
  }
}

function scheduleTokenRefresh(delay) {
  setTimeout(async () => {
    await refreshAdminToken();
    // Schedule next refresh
    scheduleTokenRefresh(TOKEN_REFRESH_INTERVAL);
  }, delay);
}

// Background admin token refresh
async function refreshAdminToken() {
  if (tokenRefreshInProgress) {
    console.log("🔄 Token refresh already in progress...");
    return;
  }

  tokenRefreshInProgress = true;
  
  try {
    console.log("🔄 Refreshing admin token...");
    
    // Test current token first
    const testResult = await testAdminToken();
    if (testResult.valid) {
      console.log("✅ Current admin token is still valid");
      lastTokenRefresh = Date.now();
      tokenRefreshInProgress = false;
      return;
    }

    // If token is expired or invalid, attempt to refresh
    console.log("⚠️ Admin token needs refresh");
    
    // Create a hidden iframe to perform silent refresh
    const refreshResult = await performSilentTokenRefresh();
    
    if (refreshResult.success) {
      ADMIN_TOKEN = refreshResult.token;
      adminDbx = new Dropbox.Dropbox({ accessToken: ADMIN_TOKEN });
      lastTokenRefresh = Date.now();
      console.log("✅ Admin token refreshed successfully");
    } else {
      console.error("❌ Failed to refresh admin token");
      // Fallback: continue with existing token and try again later
    }
    
  } catch (error) {
    console.error("❌ Token refresh error:", error);
  } finally {
    tokenRefreshInProgress = false;
  }
}

// Test if admin token is still valid
async function testAdminToken() {
  try {
    await safeDropboxCall(() => 
      adminDbx.usersGetCurrentAccount()
    );
    return { valid: true };
  } catch (error) {
    if (error.status === 401) {
      return { valid: false, reason: 'unauthorized' };
    }
    return { valid: false, reason: 'error', error };
  }
}

// Perform silent token refresh using hidden iframe
async function performSilentTokenRefresh() {
  return new Promise((resolve) => {
    try {
      // Create hidden iframe for silent refresh
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      
      // Construct silent refresh URL
      const refreshUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=token&redirect_uri=${window.location.origin}&prompt=none`;
      
      // Set up message listener for the iframe
      const messageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'token_refresh') {
            window.removeEventListener('message', messageHandler);
            document.body.removeChild(iframe);
            
            if (data.success && data.token) {
              resolve({ success: true, token: data.token });
            } else {
              resolve({ success: false, error: data.error });
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Set iframe source
      iframe.src = refreshUrl;
      document.body.appendChild(iframe);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve({ success: false, error: 'timeout' });
      }, 10000);
      
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}

// Enhanced safeDropboxCall with admin token refresh
async function safeDropboxCall(fn, retries = 3, delay = 1000, isAdminCall = false) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // If it's an admin call and we get 401, try refreshing token
      if (isAdminCall && err.status === 401 && !tokenRefreshInProgress) {
        console.log("🔄 Admin token expired, attempting refresh...");
        await refreshAdminToken();
        // Retry the call with new token
        try {
          return await fn();
        } catch (retryErr) {
          console.error("❌ Call failed even after token refresh:", retryErr);
        }
      }
      
      if (err.status === 429 && attempt < retries) {
        console.warn(`⏳ Rate limited, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries + 1})`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
        continue;
      }
      
      if (err.status >= 500 && attempt < retries) {
        console.warn(`🔄 Server error, retrying... (attempt ${attempt + 1}/${retries + 1})`);
        await sleep(delay);
        continue;
      }
      
      throw err;
    }
  }
}

// Authentication functions - login logic that's quite melodic
function login() {
  const redirectUri = window.location.origin;
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=token&redirect_uri=${redirectUri}`;
  location.href = authUrl;
}

function logout() {
  localStorage.removeItem("dropbox-token");
  promptLogCache = [];
  logsLoaded = false;
  location.reload();
}

// Initialize the app with Dropbox connectivity
function init() {
  // Initialize admin token first
  if (!initializeAdminToken()) {
    alert("❌ Application not configured properly. Please contact the administrator.");
    return;
  }

  const token = extractTokenFromUrl() || localStorage.getItem("dropbox-token");
  
  if (token) {
    setupDropboxConnection(token);
  } else {
    showLoginInterface();
  }
}

function extractTokenFromUrl() {
  return new URLSearchParams(location.hash.substr(1)).get("access_token");
}

// Replace the setupDropboxConnection function with this version:
async function setupDropboxConnection(token) {
  try {
    localStorage.setItem("dropbox-token", token);
    dbxUser = new Dropbox.Dropbox({ accessToken: token });

    const userResponse = await dbxUser.usersGetCurrentAccount();
    userInfo = userResponse.result;

    console.log("✅ User authenticated successfully:", userInfo.name.display_name);
    
    // Show main interface IMMEDIATELY after authentication
    showMainInterface();
    document.querySelector('.login-page').style.display = 'none';
    
    // Then initialize user environment in background
    await initializeUserEnvironment();
    
  } catch (err) {
    console.error("❌ Authentication failed:", err);
    handleAuthError();
  }
}

// Modify the initializeUserEnvironment function to handle errors gracefully:
async function initializeUserEnvironment() {
  try {
    await ensureUserFolder();
    await ensureLogsFolder();
    
    // Load logs in background - don't block the UI
    loadPromptLogs().catch(err => {
      console.warn("⚠️ Failed to load logs:", err);
    });
    
    // Load feed in background - don't block the UI
    loadFeed().catch(err => {
      console.warn("⚠️ Failed to load feed:", err);
      document.getElementById("media-list").innerHTML = "🚫 Failed to load feed. Try refreshing.";
    });
    
  } catch (err) {
    console.error("❌ Environment initialization failed:", err);
    // Don't hide the main interface, just show a warning
    alert("⚠️ Some features may not work properly. Please refresh the page.");
  }
}



function showLoginInterface() {
  document.querySelector("button[onclick='login()']").style.display = "block";
  document.getElementById("main-app").style.display = "none";
}

// Also modify the showMainInterface function to be more robust:
function showMainInterface() {
  const mainApp = document.getElementById("main-app");
  const loginButton = document.querySelector("button[onclick='login()']");
  const userInfoElement = document.getElementById("user-info");
  
  if (mainApp) {
    mainApp.style.display = "block";
    console.log("✅ Main interface displayed");
  } else {
    console.error("❌ main-app element not found");
  }
  
  if (loginButton) {
    loginButton.style.display = "none";
  }
  
  if (userInfoElement && userInfo) {
    userInfoElement.innerText = `👤 Welcome, ${userInfo.name.display_name}`;
  }
  
  // Set a placeholder message for the media list while it loads
  const mediaList = document.getElementById("media-list");
  if (mediaList && !mediaList.innerHTML.trim()) {
    mediaList.innerHTML = "⏳ Loading feed...";
  }
}

function handleAuthError() {
  localStorage.removeItem("dropbox-token");
  showLoginInterface();
  alert("❌ Authentication failed. Please try logging in again.");
}

// Folder management - ensure directories exist with style
async function ensureUserFolder() {
  await ensureFolderExists(USER_FOLDER, dbxUser);
}

async function ensureLogsFolder() {
  await ensureFolderExists(LOGS_FOLDER, adminDbx, true);
}

async function ensureFolderExists(folderPath, dropboxInstance, isAdminCall = false) {
  try {
    await safeDropboxCall(() => 
      dropboxInstance.filesGetMetadata({ path: folderPath }), 3, 1000, isAdminCall
    );
    console.log(`✅ Folder exists: ${folderPath}`);
  } catch (err) {
    if (err?.status === 409) {
      await safeDropboxCall(() =>
        dropboxInstance.filesCreateFolderV2({ path: folderPath }), 3, 1000, isAdminCall
      );
      console.log(`✅ Folder created: ${folderPath}`);
    } else {
      throw err;
    }
  }
}

// Upload functionality with enhanced error handling
async function uploadPrompt() {
  if (uploadInProgress) {
    alert("⏳ Upload already in progress...");
    return;
  }

  const file = document.getElementById("mediaFile").files[0];
  const prompt = document.getElementById("prompt").value.trim();
  
  if (!validateUploadInputs(file, prompt)) return;

  uploadInProgress = true;
  updateUploadButton("⏳ Uploading...", true);

  try {
    const uploadResult = await processFileUpload(file, prompt);
    if (uploadResult.success) {
      await logPromptData(uploadResult.data);
      showUploadSuccess();
      clearUploadForm();
      loadFeed(); // Refresh the feed
    }
  } catch (error) {
    console.error("🚨 Upload failed:", error);
    showUploadError(error.message);
  } finally {
    uploadInProgress = false;
    updateUploadButton("🚀 Upload Prompt", false);
  }
}

function validateUploadInputs(file, prompt) {
  if (!file) {
    alert("📁 Please select a media file");
    return false;
  }
  if (!prompt) {
    alert("📝 Please enter a prompt");
    return false;
  }
  if (prompt.length > 500) {
    alert("📝 Prompt too long (max 500 characters)");
    return false;
  }
  
  // File size validation (10MB limit for images, 50MB for others)
  const isImage = isImageFile(file.name);
  const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for others
  
  if (file.size > maxSize) {
    const maxSizeMB = isImage ? "10MB" : "50MB";
    alert(`📁 File too large! Maximum size: ${maxSizeMB}`);
    return false;
  }
  
  return true;
}

async function processFileUpload(file, prompt) {
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name);
  const filePath = `${USER_FOLDER}/${timestamp}_${safeName}`;

  try {
    // Upload file to user's folder
    const uploadRes = await safeDropboxCall(() =>
      dbxUser.filesUpload({
        path: filePath,
        contents: file,
        mode: "add"
      })
    );

    console.log("✅ File uploaded successfully:", uploadRes.result.name);

    // For images and GIFs, convert to base64 data URI for better rendering
    let mediaLink;
    let mediaData = null;
    
    const isImageOrGif = isImageFile(file.name);
    
    if (isImageOrGif) {
      try {
        mediaData = await convertFileToDataURI(file);
        mediaLink = "data_uri"; // Placeholder - we'll use mediaData instead
        console.log("✅ Image converted to data URI");
      } catch (conversionError) {
        console.warn("⚠️ Failed to convert to data URI, falling back to link:", conversionError);
        // Fall back to regular link method
        mediaData = null;
        mediaLink = await getDropboxLink(filePath);
      }
    } else {
      // For non-images, use regular Dropbox link
      mediaLink = await getDropboxLink(filePath);
    }

    return {
      success: true,
      data: {
        user: userInfo.name.display_name,
        email: userInfo.email,
        prompt,
        mediaLink,
        mediaData, // Base64 data for images/GIFs
        timestamp,
        fileName: safeName,
        isImage: isImageOrGif
      }
    };

  } catch (uploadError) {
    throw new Error(`File upload failed: ${uploadError.message}`);
  }
}

function isImageFile(fileName) {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  const ext = getFileExtension(fileName);
  return imageExtensions.includes(ext);
}

async function convertFileToDataURI(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function getDropboxLink(filePath) {
  try {
    const linkRes = await safeDropboxCall(() =>
      dbxUser.filesGetTemporaryLink({ path: filePath })
    );
    return linkRes.result.link;
  } catch (linkError) {
    console.warn("⚠️ Could not generate link:", linkError);
    return "Link unavailable";
  }
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

async function logPromptData(data) {
  try {
    const logPath = `${LOGS_FOLDER}/${data.timestamp}.json`;
    
    await safeDropboxCall(() =>
      adminDbx.filesUpload({
        path: logPath,
        contents: JSON.stringify(data, null, 2),
        mode: "add"
      }), 3, 1000, true // Mark as admin call
    );

    console.log("✅ Metadata logged successfully");
    
    // Add to local cache immediately
    promptLogCache.push(data);
    
  } catch (logError) {
    console.error("⚠️ Failed to log metadata:", logError);
    // Don't throw - file upload was successful
  }
}

function updateUploadButton(text, disabled) {
  const button = document.querySelector("button[onclick='uploadPrompt()']");
  button.innerText = text;
  button.disabled = disabled;
}

function showUploadSuccess() {
  alert("✅ Prompt uploaded successfully!");
}

function showUploadError(message) {
  alert(`❌ Upload failed: ${message}`);
}

function clearUploadForm() {
  document.getElementById("prompt").value = "";
  document.getElementById("mediaFile").value = "";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Feed loading with better error handling
async function loadFeed() {
  const listDiv = document.getElementById("media-list");
  listDiv.innerHTML = "⏳ Loading feed...";
  
  try {
    const folder = await safeDropboxCall(() =>
      adminDbx.filesListFolder({ path: LOGS_FOLDER }), 3, 1000, true
    );

    if (!folder.result?.entries?.length) {
      listDiv.innerHTML = "🚫 No prompts shared yet. Be the first!";
      return;
    }

    await renderFeedEntries(folder.result.entries, adminDbx, listDiv);
    
  } catch (err) {
    console.error("🚫 Failed to load feed:", err);
    listDiv.innerHTML = "🚫 Failed to load feed. Try refreshing.";
  }
}

async function renderFeedEntries(entries, adminDropbox, container) {
  container.innerHTML = "";
  
  // Sort by newest first
  const sortedEntries = entries
    .filter(entry => entry.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const file of sortedEntries) {
    try {
      const data = await safeDropboxCall(() =>
        adminDropbox.filesDownload({ path: file.path_display }), 3, 1000, true
      );
      
      // Handle different Dropbox API response formats
      let text;
      if (data.result?.fileBinary) {
        text = await data.result.fileBinary.text();
      } else if (data.fileBlob) {
        text = await data.fileBlob.text();
      } else if (data.result?.fileBlob) {
        text = await data.result.fileBlob.text();
      } else {
        console.warn(`⚠️ Unknown response format for: ${file.name}`, data);
        continue;
      }
      
      const json = JSON.parse(text);
      
      if (isValidLogEntry(json)) {
        container.appendChild(createFeedItem(json));
      }
      
    } catch (err) {
      console.warn(`⚠️ Failed to load entry: ${file.name}`, err);
    }
  }
}

function isValidLogEntry(json) {
  return json && json.prompt && json.user && (json.mediaLink || json.mediaData) && json.timestamp;
}

function createFeedItem(json) {
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.style.cssText = 'border:1px solid #ddd; margin-bottom:20px; padding:20px; border-radius:12px; background:linear-gradient(135deg, #f8f9fa 0%, #fff 100%); box-shadow: 0 4px 12px rgba(0,0,0,0.05);';

  const { prompt, user, timestamp } = json;
  const date = new Date(timestamp).toLocaleDateString();
  const mediaContent = generateMediaContent(json);

  div.innerHTML = `
    <div style="margin-bottom:15px;">
      <strong style="color:#2c3e50; font-size:16px;">📝 Prompt:</strong> 
      <div style="margin-top:8px; padding:12px; background:#f1f3f4; border-radius:8px; font-style:italic; color:#444;">
        "${escapeHtml(prompt)}"
      </div>
    </div>
    <div style="margin-bottom:15px; color:#666; font-size:14px;">
      <strong>👤 Created by:</strong> ${escapeHtml(user)} • ${date}
    </div>
    <div style="margin-top:15px; text-align:center;">
      ${mediaContent}
    </div>
  `;

  return div;
}

function generateMediaContent(json) {
  const { mediaLink, mediaData, isImage } = json;
  
  // Use data URI for images/GIFs if available
  if (isImage && mediaData) {
    return `<img src="${mediaData}" style="max-width:100%; height:auto; border-radius:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" loading="lazy" alt="User uploaded image">`;
  }
  
  // Fallback to regular link handling
  if (mediaLink === "Link unavailable") {
    return '<em style="color:#999;">📎 Media link unavailable</em>';
  }

  const ext = getFileExtension(mediaLink);
  
  if (["jpg", "png", "jpeg", "gif", "webp"].includes(ext)) {
    return `<img src="${mediaLink}" style="max-width:100%; height:auto; border-radius:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" loading="lazy" onerror="this.style.display='none'" alt="User uploaded image">`;
  } else if (["mp4", "webm", "mov"].includes(ext)) {
    return `<video src="${mediaLink}" controls style="max-width:100%; height:auto; border-radius:4px;" preload="metadata">Your browser doesn't support video.</video>`;
  } else if (["mp3", "wav", "ogg"].includes(ext)) {
    return `<audio src="${mediaLink}" controls style="width:100%; margin-top:10px;">Your browser doesn't support audio.</audio>`;
  } else {
    return `<a href="${mediaLink}" target="_blank" style="color:#007bff; text-decoration:none; font-weight:500;">📎 View Media File</a>`;
  }
}

function getFileExtension(url) {
  return url.split('.').pop().split('?')[0].toLowerCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Enhanced prompt log loading
async function loadPromptLogs() {
  if (logsLoaded) {
    console.log("📚 Logs already loaded, skipping...");
    return;
  }

  try {
    console.log("📚 Loading prompt logs...");
    promptLogCache = []; // Clear existing cache
    
    const folder = await safeDropboxCall(() =>
      adminDbx.filesListFolder({ path: LOGS_FOLDER }), 3, 1000, true
    );

    if (!folder.result?.entries?.length) {
      console.log("📚 No logs found yet");
      logsLoaded = true;
      return;
    }

    const jsonFiles = folder.result.entries.filter(entry => entry.name.endsWith('.json'));
    
    for (const file of jsonFiles) {
      try {
        const data = await safeDropboxCall(() =>
          adminDbx.filesDownload({ path: file.path_display }), 3, 1000, true
        );
        
        // Handle different Dropbox API response formats
        let text;
        if (data.result?.fileBinary) {
          text = await data.result.fileBinary.text();
        } else if (data.fileBlob) {
          text = await data.fileBlob.text();
        } else if (data.result?.fileBlob) {
          text = await data.result.fileBlob.text();
        } else {
          console.warn(`⚠️ Unknown response format for: ${file.name}`, data);
          continue;
        }
        
        const json = JSON.parse(text);
        
        if (isValidLogEntry(json)) {
          promptLogCache.push(json);
        } else {
          console.warn(`⚠️ Invalid log entry: ${file.name}`);
        }
        
      } catch (parseError) {
        console.error(`❌ Failed to parse log: ${file.name}`, parseError);
      }
    }
    
    logsLoaded = true;
    console.log(`✅ Loaded ${promptLogCache.length} prompt logs`);
    
  } catch (err) {
    console.error("🚫 Failed to load prompt logs:", err);
    logsLoaded = false;
  }
}

// Enhanced AI Bot functionality
async function openBot() {
  const modal = document.getElementById("aiBotModal");
  modal.style.display = "flex";
  
  if (!logsLoaded) {
    addBotMessage("🔄 Loading prompt database...");
    await loadPromptLogs();
    if (logsLoaded) {
      addBotMessage("✅ Ready! Ask me about prompts or type 'help' for commands.");
    } else {
      addBotMessage("⚠️ Couldn't load database, but I can still chat!");
    }
  } else {
    addBotMessage(`😇 Hello! I have ${promptLogCache.length} prompts in my database. How can I help?`);
  }
}

function closeBot() {
  document.getElementById("aiBotModal").style.display = "none";
}

async function askBot() {
  const input = document.getElementById("botInput");
  const userQuery = input.value.trim();
  
  if (!userQuery) return;

  addBotMessage(`🧍‍♂️ You: ${userQuery}`);
  input.value = "";

  // Process the query
  setTimeout(() => {
    handleBotQuery(userQuery.toLowerCase());
  }, 500); // Small delay for natural feel
}

function handleBotQuery(query) {
  // Handle special commands
  if (query === 'help') {
    showBotHelp();
    return;
  }
  
  if (query.includes('count') || query.includes('how many')) {
    addBotMessage(`😇 Me: I have ${promptLogCache.length} prompts in my heavenly database! 🙌`);
    return;
  }

  if (query.includes('clear') || query.includes('reset')) {
    clearBotMessages();
    addBotMessage("😇 Me: Chat cleared! How can I help you now?");
    return;
  }

  // Search for matching prompts
  const matches = findPromptMatches(query);
  
  if (matches.length > 0) {
    showPromptMatches(matches, query);
  } else {
    showNoMatches(query);
  }
}

function findPromptMatches(query) {
  const matches = [];
  
  // Exact matches first
  const exactMatches = promptLogCache.filter(p => 
    p.prompt.toLowerCase().includes(query) || 
    query.includes(p.prompt.toLowerCase())
  );
  
  matches.push(...exactMatches);
  
  // Keyword matches if no exact matches
  if (matches.length === 0) {
    const keywords = query.split(' ').filter(w => w.length > 2);
    const keywordMatches = promptLogCache.filter(p => 
      keywords.some(kw => p.prompt.toLowerCase().includes(kw))
    );
    matches.push(...keywordMatches.slice(0, 3)); // Limit to 3 results
  }
  
  return matches;
}

function showPromptMatches(matches, query) {
  if (matches.length === 1) {
    const match = matches[0];
    addBotMessage(`😇 Me: Found a perfect match! Here's what ${match.user} created:`);
    addBotMessage(`📝 Prompt: "${match.prompt}"`);
    addBotMessage(`🎯 Media: <a href="${match.mediaLink}" target="_blank" style="color:#007bff;">View Result</a>`);
    addBotMessage(`💡 Try variations like: "${generatePromptVariation(match.prompt)}"`);
  } else {
    addBotMessage(`😇 Me: Found ${matches.length} similar prompts! Here are the highlights:`);
    matches.slice(0, 2).forEach((match, index) => {
      addBotMessage(`${index + 1}. "${match.prompt}" by ${match.user} - <a href="${match.mediaLink}" target="_blank" style="color:#007bff;">View</a>`);
    });
    if (matches.length > 2) {
      addBotMessage(`...and ${matches.length - 2} more! Try being more specific.`);
    }
  }
}

function showNoMatches(query) {
  const suggestions = [
    "That's uncharted territory! 🗺️ You could be the first to try it.",
    "No matches yet, but that sounds like divine inspiration! ✨",
    "Virgin prompt territory! Time to be a pioneer! 🚀",
    "Nothing similar exists - you're breaking new ground! 🌱"
  ];
  
  const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
  addBotMessage(`😇 Me: ${randomSuggestion}`);
  
  if (promptLogCache.length > 0) {
    const randomPrompt = promptLogCache[Math.floor(Math.random() * promptLogCache.length)];
    addBotMessage(`💡 Here's a random inspiration: "${randomPrompt.prompt}"`);
  }
}

function generatePromptVariation(originalPrompt) {
  const variations = [
    `${originalPrompt} but in a different style`,
    `${originalPrompt} with vibrant colors`,
    `${originalPrompt} in minimalist style`,
    `${originalPrompt} with dramatic lighting`
  ];
  
  return variations[Math.floor(Math.random() * variations.length)];
}

function showBotHelp() {
  addBotMessage("😇 Me: Here's what I can do:");
  addBotMessage("🔍 Search prompts: Just describe what you're looking for");
  addBotMessage("📊 Get stats: Ask 'how many prompts' or 'count'");
  addBotMessage("🧹 Clear chat: Type 'clear' or 'reset'");
  addBotMessage("💡 Get inspiration: I'll suggest random prompts when I can't find matches");
  addBotMessage("✨ Just chat with me about anything prompt-related!");
}

function clearBotMessages() {
  document.getElementById("botMessages").innerHTML = "";
}

function addBotMessage(message) {
  const messagesContainer = document.getElementById("botMessages");
  const messageDiv = document.createElement("div");
  messageDiv.style.cssText = 'margin-bottom:10px; padding:8px; background:#f5f5f5; border-radius:4px; animation: fadeIn 0.3s ease-in;';
  messageDiv.innerHTML = message;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Enhanced keyboard support
document.addEventListener('DOMContentLoaded', function() {
  // Add Enter key support for bot input
  const botInput = document.getElementById("botInput");
  if (botInput) {
    botInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askBot();
      }
    });
  }

  // Add Enter key support for main prompt input
  const promptInput = document.getElementById("prompt");
  if (promptInput) {
    promptInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        uploadPrompt();
      }
    });
  }
});

// Initialize the application when page loads
init();
