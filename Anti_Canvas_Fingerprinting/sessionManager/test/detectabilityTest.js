/**
 * detectabilityTest.js - Test if canvas fingerprinting protection is detectable
 * 
 * This script opens two browser instances (Chrome) with WebBrowserTools:
 * - One with canvas protection enabled
 * - One without protection
 * This allows manual comparison to see if the protection is detectable.
 */

const { chromium } = require('playwright');
const { injectSpoofing } = require('../injectSpoofing');

/**
 * Opens browser instances to test detection of fingerprinting protection
 */
async function runDetectabilityTest() {
  console.log('Starting canvas protection detectability test...');
  
  // Create instances array to keep track of all browsers
  const instances = [];
  
  try {
    // Instance 1: With protection
    console.log('\n--- Creating Instance 1: WITH Canvas Protection ---');
    const browser1 = await chromium.launch({
      headless: false,
      channel: 'chrome', // Use installed Chrome if available, otherwise use bundled Chromium
    });
    instances.push(browser1);
    
    const context1 = await browser1.newContext();
    
    // Inject canvas spoofing
    const result = await injectSpoofing(context1);
    console.log('Protection active with seed:', result.seed);
    
    const page1 = await context1.newPage();
    await page1.goto('https://webbrowsertools.com/canvas-fingerprint/');
    await page1.waitForLoadState('networkidle');
    
    console.log('✅ Loaded WebBrowserTools in Instance 1 (WITH protection)');
    console.log('   Check if it detects canvas fingerprint spoofing');
    
    // Instance 2: WITHOUT protection
    console.log('\n--- Creating Instance 2: WITHOUT Canvas Protection ---');
    const browser2 = await chromium.launch({
      headless: false,
      channel: 'chrome', // Use installed Chrome if available, otherwise use bundled Chromium
    });
    instances.push(browser2);
    
    const context2 = await browser2.newContext();
    // No protection injected
    
    const page2 = await context2.newPage();
    await page2.goto('https://webbrowsertools.com/canvas-fingerprint/');
    await page2.waitForLoadState('networkidle');
    
    console.log('✅ Loaded WebBrowserTools in Instance 2 (WITHOUT protection)');
    console.log('   Check if it shows normal canvas fingerprinting (no detection)');
    
    // Check for detection messages
    const checkForDetection = async (page, instanceName) => {
      try {
        // Look for detection messages in the page content
        const detectionText = await page.evaluate(() => {
          const content = document.body.textContent;
          if (content.includes('canvas fingerprinting protection') || 
              content.includes('Tor Browser') || 
              content.includes('canvas poisoning') ||
              content.includes('randomization detected')) {
            return 'DETECTED';
          }
          return 'NOT DETECTED';
        });
        
        console.log(`${instanceName}: Canvas protection ${detectionText}`);
      } catch (e) {
        console.log(`${instanceName}: Error checking for detection`);
      }
    };
    
    // Wait a moment for any detection to occur
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for detection in both instances
    await checkForDetection(page1, 'Instance 1 (WITH protection)');
    await checkForDetection(page2, 'Instance 2 (WITHOUT protection)');
    
    // Keep all browsers open for manual comparison
    console.log('\n--- Analysis Instructions ---');
    console.log('1. Compare the visual display of the canvas test in both windows');
    console.log('2. Look for any messages about detected protection or randomization');
    console.log('3. Check if refreshing shows different canvas outputs in the protected instance');
    console.log('4. Note any visual artifacts or differences in the protected canvas rendering');
    
    console.log('\nBrowsers will remain open for manual inspection');
    console.log('Press Ctrl+C to close all instances when finished');
    
    // Keep the script running until manually terminated
    await new Promise(resolve => {
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
    console.log('\nDetectability test completed. All instances closed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runDetectabilityTest().catch(console.error);
}

module.exports = {
  runDetectabilityTest
};