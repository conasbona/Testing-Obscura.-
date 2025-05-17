/**
 * chromeCanvasTest.js - Test canvas fingerprinting in Chrome/Chromium browser
 * 
 * This script performs the same simplified test as before but using Chrome
 * instead of Firefox to compare canvas fingerprinting behavior across browsers.
 */

const { chromium } = require('playwright');
const { injectSpoofing } = require('../injectSpoofing');

/**
 * Opens multiple Chromium browser instances for manual comparison
 */
async function runChromeCanvasTest() {
  console.log('Starting Chrome/Chromium canvas fingerprinting test...');
  
  // Create instances array to keep track of all browsers
  const instances = [];
  
  try {
    // Instance 1: With protection (default settings)
    console.log('\n--- Creating Chrome Instance 1: WITH Canvas Protection (default settings) ---');
    const browser1 = await chromium.launch({
      headless: false,
      channel: 'chrome', // Use installed Chrome if available, otherwise use bundled Chromium
    });
    instances.push(browser1);
    
    const context1 = await browser1.newContext();
    
    // Inject canvas spoofing with default settings
    const result1 = await injectSpoofing(context1);
    console.log('Protection active with seed:', result1.seed);
    
    const page1 = await context1.newPage();
    await page1.goto('https://browserleaks.com/canvas');
    await page1.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks in Chrome Instance 1 (WITH protection)');
    console.log('   Please note the Canvas Hash Signature value');
    
    // Instance 2: WITHOUT protection (for comparison)
    console.log('\n--- Creating Chrome Instance 2: WITHOUT Canvas Protection ---');
    const browser2 = await chromium.launch({
      headless: false,
      channel: 'chrome', // Use installed Chrome if available, otherwise use bundled Chromium
    });
    instances.push(browser2);
    
    const context2 = await browser2.newContext();
    // No protection injected
    
    const page2 = await context2.newPage();
    await page2.goto('https://browserleaks.com/canvas');
    await page2.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks in Chrome Instance 2 (WITHOUT protection)');
    console.log('   Please note the Canvas Hash Signature value');
    
    // Script to extract canvas hash
    const getCanvasHash = async (page) => {
      try {
        return await page.evaluate(() => {
          const hashElement = document.querySelector('table.table-sm tr:nth-child(2) td:nth-child(2)');
          return hashElement ? hashElement.textContent.trim() : null;
        });
      } catch (e) {
        return "Unable to extract hash";
      }
    };
    
    // Wait a moment for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get initial hashes
    const protectedHash = await getCanvasHash(page1);
    const unprotectedHash = await getCanvasHash(page2);
    
    console.log('\n--- Initial Canvas Hash Values ---');
    console.log(`Protected Instance:   ${protectedHash}`);
    console.log(`Unprotected Instance: ${unprotectedHash}`);
    
    // Test refresh behavior
    console.log('\n--- Testing Refresh Behavior ---');
    console.log('Refreshing both instances...');
    
    // Refresh both pages
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    
    // Get new hashes after refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    const protectedHashAfterRefresh = await getCanvasHash(page1);
    const unprotectedHashAfterRefresh = await getCanvasHash(page2);
    
    console.log('\n--- Canvas Hash Values After Refresh ---');
    console.log(`Protected Instance:   ${protectedHashAfterRefresh}`);
    console.log(`Unprotected Instance: ${unprotectedHashAfterRefresh}`);
    
    // Report on changes
    console.log('\n--- Analysis ---');
    if (protectedHash !== protectedHashAfterRefresh) {
      console.log('✅ SUCCESS: Protected instance hash changed after refresh');
    } else {
      console.log('❌ WARNING: Protected instance hash remained the same after refresh');
    }
    
    if (unprotectedHash === unprotectedHashAfterRefresh) {
      console.log('✅ Expected: Unprotected instance hash remained the same after refresh');
    } else {
      console.log('⚠️ Unusual: Unprotected instance hash changed after refresh');
    }
    
    // Keep all browsers open for manual comparison
    console.log('\n--- All instances loaded ---');
    console.log('Please manually compare the Canvas Hash Signature values in each browser window');
    console.log('Try refreshing multiple times to observe the pattern');
    console.log('\nBrowser will remain open for 30 seconds for manual testing, then close automatically');
    
    // Keep open for manual testing, then close automatically
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Close all browser instances
    for (const browser of instances) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore errors during closing
      }
    }
    console.log('\nChrome canvas test completed. All instances closed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runChromeCanvasTest().catch(console.error);
}

module.exports = {
  runChromeCanvasTest
};