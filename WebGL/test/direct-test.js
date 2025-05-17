// test/direct-test.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runDirectTest() {
  console.log('🧪 DIRECT WEBGL PROTECTION TEST');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Get the protection code
  const bundlePath = path.join(__dirname, '../dist/webgl-protection.bundle.js');
  if (!fs.existsSync(bundlePath)) {
    console.error('❌ Bundle file not found! Run "npm run build" first.');
    await browser.close();
    return;
  }
  
  const protectionCode = fs.readFileSync(bundlePath, 'utf8');
  
  // Inject config first
  await page.addInitScript(() => {
    window._webglProtectionConfig = {
      enabled: true,
      debug: { enabled: true, visualIndicator: true },
      parameters: { enabled: true },
      extensions: { 
        enabled: true,
        blockedExtensions: [
          'WEBGL_debug_renderer_info',
          'EXT_disjoint_timer_query',
          'EXT_disjoint_timer_query_webgl2'
        ]
      },
      drawCalls: { enabled: true },
      readback: { enabled: true }
    };
    
    // Add visual indicator to the page
    const div = document.createElement('div');
    div.id = 'protection-indicator';
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.right = '10px';
    div.style.backgroundColor = 'red';
    div.style.color = 'white';
    div.style.padding = '5px';
    div.style.zIndex = '9999';
    div.textContent = 'INITIALIZING...';
    document.body.appendChild(div);
  });
  
  // Inject protection code
  await page.addInitScript(protectionCode);
  
  // Navigate to a blank page 
  await page.goto('about:blank');
  
  // Run a direct test script
  await page.evaluate(() => {
    const logDiv = document.createElement('div');
    logDiv.style.margin = '20px';
    logDiv.style.fontFamily = 'monospace';
    logDiv.style.whiteSpace = 'pre';
    document.body.appendChild(logDiv);
    
    function log(message) {
      logDiv.innerHTML += message + '<br>';
      console.log(message);
    }
    
    log('🧪 WebGL Protection Direct Test');
    
    // Test 1: Check if protection is initialized
    log('\nTest 1: Initialization');
    if (window.enableWebGLProtection) {
      log('✅ window.enableWebGLProtection function exists');
      
      // Update indicator
      const indicator = document.getElementById('protection-indicator');
      if (indicator) indicator.textContent = 'PROTECTION READY';
    } else {
      log('❌ window.enableWebGLProtection function NOT found');
    }
    
    // Test 2: Create WebGL context and check if protection works
    log('\nTest 2: WebGL Context Protection');
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    document.body.appendChild(canvas);
    
    const gl = canvas.getContext('webgl');
    if (!gl) {
      log('❌ Failed to create WebGL context');
      return;
    }
    
    log('✅ WebGL context created');
    
    // Test 3: Check if WEBGL_debug_renderer_info is blocked
    log('\nTest 3: Extension Blocking');
    const debugExtension = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExtension) {
      log('❌ WEBGL_debug_renderer_info NOT blocked');
      
      // Show the renderer info that should be blocked
      const vendor = gl.getParameter(debugExtension.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugExtension.UNMASKED_RENDERER_WEBGL);
      log(`Unmasked Vendor: ${vendor}`);
      log(`Unmasked Renderer: ${renderer}`);
    } else {
      log('✅ WEBGL_debug_renderer_info successfully blocked');
    }
    
    // Test 4: Check all supported extensions
    log('\nTest 4: Available Extensions');
    const extensions = gl.getSupportedExtensions();
    log(`Total extensions available: ${extensions.length}`);
    if (extensions.includes('WEBGL_debug_renderer_info')) {
      log('❌ WEBGL_debug_renderer_info still in supported extensions list');
    } else {
      log('✅ WEBGL_debug_renderer_info not in supported extensions list');
    }
    
    // Finalize
    log('\nTest complete.');
  });
  
  // Keep the browser open for inspection
  console.log('Browser window opened with direct test. Press Enter to close.');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  await browser.close();
}

runDirectTest().catch(console.error);