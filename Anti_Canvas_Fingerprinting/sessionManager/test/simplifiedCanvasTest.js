/**
 * simplifiedCanvasTest.js - Focused test for canvas fingerprinting using BrowserLeaks
 * 
 * This script creates multiple browser instances with different configurations
 * to allow manual comparison of canvas fingerprints on browserleaks.com
 */

const { firefox } = require('playwright');
const { injectSpoofing } = require('../injectSpoofing');

/**
 * Opens multiple browser instances for manual comparison
 */
async function runSimplifiedCanvasTest() {
  console.log('Starting simplified canvas fingerprinting test...');
  
  // Create instances array to keep track of all browsers
  const instances = [];
  
  try {
    // Instance 1: With protection (default settings)
    console.log('\n--- Creating Instance 1: WITH Canvas Protection (default settings) ---');
    const browser1 = await firefox.launch({
      headless: false
    });
    instances.push(browser1);
    
    const context1 = await browser1.newContext();
    
    // Inject canvas spoofing with default settings
    const result1 = await injectSpoofing(context1);
    console.log('Protection active with seed:', result1.seed);
    
    const page1 = await context1.newPage();
    await page1.goto('https://browserleaks.com/canvas');
    await page1.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks in Instance 1 (WITH protection, default settings)');
    console.log('   Please note the Canvas Hash Signature value');
    
    // Instance 2: With protection (increased noise)
    console.log('\n--- Creating Instance 2: WITH Canvas Protection (increased noise) ---');
    const browser2 = await firefox.launch({
      headless: false
    });
    instances.push(browser2);
    
    const context2 = await browser2.newContext();
    
    // Inject canvas spoofing with increased noise
    const result2 = await injectSpoofing(context2, {
      config: {
        pixelNoiseRange: 10, // Increased from default 5
        alphaNoiseRange: 5   // Increased from default 3
      }
    });
    console.log('Protection active with seed:', result2.seed);
    
    const page2 = await context2.newPage();
    await page2.goto('https://browserleaks.com/canvas');
    await page2.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks in Instance 2 (WITH protection, increased noise)');
    console.log('   Please note the Canvas Hash Signature value');
    
    // Instance 3: WITHOUT protection (for comparison)
    console.log('\n--- Creating Instance 3: WITHOUT Canvas Protection ---');
    const browser3 = await firefox.launch({
      headless: false
    });
    instances.push(browser3);
    
    const context3 = await browser3.newContext();
    // No protection injected
    
    const page3 = await context3.newPage();
    await page3.goto('https://browserleaks.com/canvas');
    await page3.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks in Instance 3 (WITHOUT protection)');
    console.log('   Please note the Canvas Hash Signature value');
    
    // Keep all browsers open for manual comparison
    console.log('\n--- All instances loaded ---');
    console.log('Please manually compare the Canvas Hash Signature values in each browser window');
    console.log('In protected instances (1 & 2), refreshing the page should produce different hashes');
    console.log('In the unprotected instance (3), refreshing should produce the same hash');
    console.log('\nPress Ctrl+C to close all instances when finished');
    
    // Keep the script running until manually terminated
    await new Promise(resolve => {
      // This will keep the script running until it's manually terminated
      process.on('SIGINT', () => {
        console.log('\nTerminating test and closing all instances...');
        resolve();
      });
    });
    
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
    console.log('\nSimplified canvas test completed. All instances closed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runSimplifiedCanvasTest().catch(console.error);
}

module.exports = {
  runSimplifiedCanvasTest
};