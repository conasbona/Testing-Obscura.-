/**
 * testCanvasSpoofing.js - Test script for canvas anti-fingerprinting
 * 
 * This script tests the canvas anti-fingerprinting implementation
 * using Playwright to verify its effectiveness against various
 * fingerprinting techniques.
 */

const { chromium, firefox } = require('playwright');
const { injectSpoofing } = require('../injectSpoofing');
const { verifyCanvasSpoofing, testCanvasFingerprinting } = require('../verify');

/**
 * Tests if the canvas spoofing is working correctly
 */
async function runCanvasSpoofingTest() {
  console.log('Starting canvas spoofing test...');
  
  // Use Firefox as specified in the implementation plan
  const browser = await firefox.launch({
    headless: false, // Set to true for CI environments
  });
  
  try {
    // Test 1: Basic Functionality - Single Context
    console.log('\n--- Test 1: Basic Functionality ---');
    const context1 = await browser.newContext();
    
    // Inject canvas spoofing
    const injectionResult = await injectSpoofing(context1, {
      config: {
        debug: true // Enable debug mode for testing
      }
    });
    console.log('Injection result:', injectionResult);
    
    // Create a page and navigate to a blank page
    const page1 = await context1.newPage();
    await page1.goto('about:blank');
    
    // Verify that spoofing is working
    const verificationResult = await verifyCanvasSpoofing(page1);
    console.log('Verification result:', verificationResult);
    
    if (verificationResult.success) {
      console.log('✅ Basic functionality test passed');
      console.log(`  - Seed used: ${verificationResult.seed}`);
      console.log(`  - Fingerprints different: ${verificationResult.fingerprintTest.different}`);
    } else {
      console.log('❌ Basic functionality test failed');
      console.log(`  - Reason: ${verificationResult.reason || 'Unknown'}`);
    }
    
    // Test 2: Different Seeds - Multiple Contexts
    console.log('\n--- Test 2: Different Seeds - Multiple Contexts ---');
    
    // Create two browser contexts
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    
    // Inject canvas spoofing with the same configuration but different seeds
    await injectSpoofing(context2);
    await injectSpoofing(context3);
    
    // Create pages and navigate to blank pages
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    await page2.goto('about:blank');
    await page3.goto('about:blank');
    
    // Get status from both pages
    const status2 = await page2.evaluate(() => window.__obscura.getStatus());
    const status3 = await page3.evaluate(() => window.__obscura.getStatus());
    
    console.log('Context 2 seed:', status2.sessionSeed);
    console.log('Context 3 seed:', status3.sessionSeed);
    
    if (status2.sessionSeed !== status3.sessionSeed) {
      console.log('✅ Different seeds test passed - Each context has a unique seed');
    } else {
      console.log('❌ Different seeds test failed - Contexts have the same seed');
    }
    
    // Test 3: Fingerprinting Resistance - Cross-Context Comparison
    console.log('\n--- Test 3: Fingerprinting Resistance ---');
    
    await context2.close();
    await context3.close();
    
    const fingerprintingResult = await testCanvasFingerprinting(browser);
    console.log('Fingerprinting test result:', fingerprintingResult);
    
    if (fingerprintingResult.different) {
      console.log('✅ Fingerprinting resistance test passed');
      console.log(`  - Similarity score: ${(fingerprintingResult.similarity * 100).toFixed(2)}%`);
    } else {
      console.log('❌ Fingerprinting resistance test failed');
      console.log('  - Canvases produced identical output across contexts');
    }
    
    // Test 4: Real-world Fingerprinting Sites
    console.log('\n--- Test 4: Real-world Fingerprinting Sites ---');
    
    // Create a new context with spoofing
    const context4 = await browser.newContext();
    await injectSpoofing(context4);
    const page4 = await context4.newPage();
    
    // Test against a fingerprinting site like AmIUnique
    console.log('Navigating to AmIUnique.org...');
    await page4.goto('https://amiunique.org/fp');
    await page4.waitForLoadState('networkidle');
    
    // Let the user manually check the results
    console.log('✅ Loaded AmIUnique.org. Check the Canvas section in the browser.');
    console.log('   Look for "Canvas fingerprinting" to confirm if it shows as "randomized" or "inconsistent".');
    
    // Wait for a moment to see results
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test browserleaks.com canvas fingerprinting test
    console.log('\nNavigating to BrowserLeaks Canvas Test...');
    await page4.goto('https://browserleaks.com/canvas');
    await page4.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks Canvas Test.');
    console.log('   Check for changing hash values when refreshing the page.');
    
    // Wait for a moment to see results
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test webbrowsertools canvas fingerprinting test
    console.log('\nNavigating to WebBrowserTools Canvas Fingerprint Test...');
    await page4.goto('https://webbrowsertools.com/canvas-fingerprint/');
    await page4.waitForLoadState('networkidle');
    
    console.log('✅ Loaded WebBrowserTools Canvas Fingerprint Test.');
    console.log('   Check if it detects canvas fingerprint spoofing.');
    
    // Wait for a moment to see results
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    await context1.close();
    await context4.close();
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
    console.log('\nCanvas spoofing test completed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runCanvasSpoofingTest().catch(console.error);
}

module.exports = {
  runCanvasSpoofingTest
};