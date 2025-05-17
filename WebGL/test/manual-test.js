// test/manual-test.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runManualTest() {
  console.log('🧪 MANUAL WEBGL FINGERPRINTING TEST');
  console.log('This test will open multiple browser windows for visual comparison');
  console.log('- Window 1: Native WebGL (no protection) on browserleaks.com');
  console.log('- Window 2: Protected WebGL on browserleaks.com');
  console.log('- Window 3: Protected WebGL on amiunique.org\n');
  
  // First test - Native WebGL on browserleaks
  console.log('🚀 Launching browser with protection DISABLED (browserleaks.com)...');
  await launchBrowser(false, 'https://browserleaks.com/webgl');
  
  console.log('\n⏱️ Waiting 3 seconds before launching next browser...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Second test - Protected WebGL on browserleaks
  console.log('🚀 Launching browser with protection ENABLED (browserleaks.com)...');
  await launchBrowser(true, 'https://browserleaks.com/webgl');
  
  console.log('\n⏱️ Waiting 3 seconds before launching next browser...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Third test - Protected WebGL on amiunique
  console.log('🚀 Launching browser with protection ENABLED (amiunique.org)...');
  await launchBrowser(true, 'https://amiunique.org/fingerprint');
  
  console.log('\n✅ Test complete. Please compare the browser windows manually.');
}

async function launchBrowser(enableProtection, url) {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Only inject the protection code if enabled
  if (enableProtection) {
    // More detailed configuration for debugging
    const config = {
      enabled: true,
      profile: {
        // Force a specific profile type for testing
        preferredVendor: "nvidia",
        preferredTier: "high"
      },
      parameters: {
        enabled: true,
        jitterPercent: 0.05
      },
      extensions: {
        enabled: true,
        blockedExtensions: [
          "WEBGL_debug_renderer_info",
          "EXT_disjoint_timer_query",
          "EXT_disjoint_timer_query_webgl2"
        ]
      },
      drawCalls: {
        enabled: true,
        noiseAmount: 0.03
      },
      readback: {
        enabled: true,
        pixelJitter: 4
      },
      debug: {
        enabled: true,
        logCalls: true,
        visualIndicator: true
      }
    };
    
    // Add visual debug indicator before injecting protection
    await page.addInitScript(() => {
      // Create a debug panel
      const debugPanel = document.createElement('div');
      debugPanel.id = 'webgl-protection-debug';
      debugPanel.style.position = 'fixed';
      debugPanel.style.top = '10px';
      debugPanel.style.right = '10px';
      debugPanel.style.backgroundColor = 'rgba(0,0,0,0.8)';
      debugPanel.style.color = 'lime';
      debugPanel.style.padding = '10px';
      debugPanel.style.borderRadius = '5px';
      debugPanel.style.zIndex = '999999';
      debugPanel.style.maxWidth = '350px';
      debugPanel.style.maxHeight = '400px';
      debugPanel.style.overflow = 'auto';
      debugPanel.style.fontFamily = 'monospace';
      debugPanel.style.fontSize = '12px';
      debugPanel.innerHTML = '<div style="color:yellow;font-weight:bold">WebGL Protection Debug</div>';
      
      // Log function
      window.webglProtectionLog = function(message) {
        console.log('[WebGL Protection]', message);
        if (debugPanel.parentNode) {
          const logEntry = document.createElement('div');
          logEntry.textContent = `> ${message}`;
          logEntry.style.borderBottom = '1px solid #333';
          logEntry.style.padding = '3px 0';
          debugPanel.appendChild(logEntry);
          debugPanel.scrollTop = debugPanel.scrollHeight;
        }
      };
      
      // Add panel when document is ready
      if (document.body) {
        document.body.appendChild(debugPanel);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(debugPanel);
        });
      }
      
      window.webglProtectionLog('Debug panel initialized');
    });
    
    // Inject config
    await page.addInitScript(({ config }) => {
      window._webglProtectionConfig = config;
      
      if (window.webglProtectionLog) {
        window.webglProtectionLog('Configuration loaded');
        window.webglProtectionLog(`Enabled: ${config.enabled}`);
        window.webglProtectionLog(`Preferred vendor: ${config.profile.preferredVendor || 'random'}`);
      }
    }, { config });
    
    // Check if bundle exists
    const bundlePath = path.join(__dirname, '../dist/webgl-protection.bundle.js');
    if (fs.existsSync(bundlePath)) {
      // Inject the protection code
      const protectionCode = fs.readFileSync(bundlePath, 'utf8');
      await page.addInitScript(protectionCode);
      console.log('✅ WebGL protection code injected');
    } else {
      console.error('❌ Bundle file not found! Run "npm run build" first.');
      await browser.close();
      return;
    }
    
    // Add post-injection verification
    await page.addInitScript(() => {
      if (window.webglProtectionLog) {
        // Check if protection initialized correctly
        if (window.enableWebGLProtection) {
          window.webglProtectionLog('Protection function found');
          
          // Verify that getContext is hooked
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          if (originalGetContext !== HTMLCanvasElement.prototype.getContext) {
            window.webglProtectionLog('✓ getContext is hooked');
          } else {
            window.webglProtectionLog('✗ getContext is NOT hooked!');
          }
          
          // Add test function
          window.testWebGLProtection = function() {
            try {
              const canvas = document.createElement('canvas');
              const gl = canvas.getContext('webgl');
              
              window.webglProtectionLog('Testing WebGL protection...');
              
              if (!gl) {
                window.webglProtectionLog('Failed to create WebGL context');
                return;
              }
              
              // Test extension blocking
              const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
              if (debugExt) {
                window.webglProtectionLog('✗ WEBGL_debug_renderer_info NOT blocked!');
              } else {
                window.webglProtectionLog('✓ WEBGL_debug_renderer_info blocked');
              }
              
              // Test supported extensions
              const extensions = gl.getSupportedExtensions();
              window.webglProtectionLog(`Extensions available: ${extensions.length}`);
              if (extensions.includes('WEBGL_debug_renderer_info')) {
                window.webglProtectionLog('✗ Extension still in list!');
              }
              
              // Log the vendor and renderer
              window.webglProtectionLog(`Vendor: ${gl.getParameter(gl.VENDOR)}`);
              window.webglProtectionLog(`Renderer: ${gl.getParameter(gl.RENDERER)}`);
              
              window.webglProtectionLog('Test complete');
            } catch (e) {
              window.webglProtectionLog(`Test error: ${e.message}`);
            }
          };
          
          // Run test after page load
          setTimeout(window.testWebGLProtection, 2000);
        } else {
          window.webglProtectionLog('✗ Protection NOT initialized!');
        }
      }
    });
  }
  
  // Navigate to test site
  await page.goto(url);
  console.log(`🌐 Opened ${url} (Protection: ${enableProtection ? 'ENABLED' : 'DISABLED'})`);
  
  // Add a title to distinguish windows
  if (enableProtection) {
    await page.evaluate(({url}) => {
      const titleBar = document.createElement('div');
      titleBar.style.position = 'fixed';
      titleBar.style.top = '0';
      titleBar.style.left = '0';
      titleBar.style.width = '100%';
      titleBar.style.backgroundColor = 'green';
      titleBar.style.color = 'white';
      titleBar.style.textAlign = 'center';
      titleBar.style.padding = '5px';
      titleBar.style.fontWeight = 'bold';
      titleBar.style.zIndex = '999998';
      titleBar.textContent = `👨‍🚀 PROTECTED BROWSER - SPOOFING ENABLED (${url})`;
      document.body.appendChild(titleBar);
    }, {url});
  } else {
    await page.evaluate(({url}) => {
      const titleBar = document.createElement('div');
      titleBar.style.position = 'fixed';
      titleBar.style.top = '0';
      titleBar.style.left = '0';
      titleBar.style.width = '100%';
      titleBar.style.backgroundColor = 'red';
      titleBar.style.color = 'white';
      titleBar.style.textAlign = 'center';
      titleBar.style.padding = '5px';
      titleBar.style.fontWeight = 'bold';
      titleBar.style.zIndex = '999998';
      titleBar.textContent = `❌ NATIVE BROWSER - NO PROTECTION (${url})`;
      document.body.appendChild(titleBar);
    }, {url});
  }
  
  // Keep the browser open for manual inspection
  console.log('Browser will stay open for manual inspection');
  
  // Don't close the browser - let the user compare both windows
}

// Run the test
runManualTest().catch(error => {
  console.error('Error during test:', error);
});