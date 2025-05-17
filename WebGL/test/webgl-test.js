// test/webgl-test.js

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function launchWithSpoofing(enabled = true) {
  console.log(`\n🚀 Launching browser with spoofing ${enabled ? 'ENABLED' : 'DISABLED'}\n`);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'] // Hide automation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();

  // Configuration for WebGL fingerprinting protection
  const config = {
    enabled,
    profile: {
      // Uncomment to force a specific vendor if desired
      // preferredVendor: 'nvidia',  
      // preferredTier: 'high',
    },
    parameters: { 
      enabled: true, 
      jitterPercent: 0.03 
    },
    readback: { 
      enabled: true, 
      pixelJitter: 2 
    },
    drawCalls: { 
      enabled: true, 
      noiseAmount: 0.02 
    },
    extensions: {
      enabled: true,
      blockedExtensions: [
        'WEBGL_debug_renderer_info',
        'EXT_disjoint_timer_query',
        'EXT_disjoint_timer_query_webgl2'
      ]
    },
    debug: {
      enabled: true,
      logCalls: true,
      visualIndicator: true
    }
  };

  // Inject config
  await page.addInitScript(({ config }) => {
    window._webglProtectionConfig = config;
    
    // Add console logging interceptor to capture logs from the page
    const originalConsoleLog = console.log;
    console.log = function(...args) {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('WebGL')) {
        console.log('%c[WebGL Protection]', 'color: blue; font-weight: bold;', ...args);
      }
      return originalConsoleLog.apply(this, args);
    };
  }, { config });

  // Inject the protection code
  const protectionCode = fs.readFileSync(
    path.join(__dirname, '../dist/webgl-protection.bundle.js'), 
    'utf8'
  );
  await page.addInitScript(protectionCode);

  // Navigate to the test site
  await page.goto('https://browserleaks.com/webgl');
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Wait for the WebGL hash to appear
  await page.waitForSelector('#webgl_hash', { timeout: 10000 });

  // Extract key fingerprinting information
  const hash = await page.$eval('#webgl_hash', el => el.textContent.trim());
  
  // Try to get renderer and vendor (might be blocked if spoofing works)
  let renderer = 'Not available';
  let vendor = 'Not available';
  
  try {
    renderer = await page.$eval('td:has-text("Unmasked Renderer") + td', el => el.textContent.trim());
  } catch (e) {
    renderer = 'PROTECTED - Not exposed';
  }
  
  try {
    vendor = await page.$eval('td:has-text("Unmasked Vendor") + td', el => el.textContent.trim());
  } catch (e) {
    vendor = 'PROTECTED - Not exposed';
  }

  // Take a screenshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(__dirname, `webgl-test-${enabled ? 'spoofed' : 'native'}-${timestamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Log results
  console.log(`\n📊 TEST RESULTS (spoofing ${enabled ? 'ENABLED' : 'DISABLED'}):`);
  console.log('🌐 WebGL Hash:', hash);
  console.log('🖼️ Renderer:', renderer);
  console.log('🏭 Vendor:', vendor);
  console.log('📷 Screenshot saved to:', screenshotPath);

  // Close the browser
  await browser.close();
  
  return { hash, renderer, vendor, screenshotPath };
}

// Run tests
(async () => {
  try {
    console.log('🧪 WEBGL FINGERPRINTING PROTECTION TEST\n');
    
    // First run with native fingerprint for comparison
    const nativeResults = await launchWithSpoofing(false);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // First spoofed session
    const spoofedResults1 = await launchWithSpoofing(true);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second spoofed session (should be different)
    const spoofedResults2 = await launchWithSpoofing(true);
    
    // Compare results
    console.log('\n🔍 COMPARISON:');
    console.log('Native WebGL Hash:', nativeResults.hash);
    console.log('Spoofed WebGL Hash (Session 1):', spoofedResults1.hash);
    console.log('Spoofed WebGL Hash (Session 2):', spoofedResults2.hash);
    
    // Check if spoofing is working correctly
    if (spoofedResults1.hash !== nativeResults.hash) {
      console.log('✅ Spoofing is active (hash differs from native)');
    } else {
      console.log('❌ Spoofing may not be working (hash matches native)');
    }
    
    if (spoofedResults1.hash !== spoofedResults2.hash) {
      console.log('✅ Session uniqueness works (hashes differ between sessions)');
    } else {
      console.log('⚠️ Sessions have the same hash (expected different)');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
})();