/**
 * browserLeaksTest.js - Simplified test script for BrowserLeaks canvas fingerprinting
 * 
 * This script focuses specifically on testing canvas fingerprinting protection
 * against real-world fingerprinting websites.
 */

const { firefox } = require('playwright');
const injectSpoofing = require('../injectSpoofing');

/**
 * Tests canvas fingerprinting protection on BrowserLeaks
 */
async function testBrowserLeaks() {
  console.log('Starting BrowserLeaks canvas test...');
  
  // Launch Firefox browser
  const browser = await firefox.launch({
    headless: false, // Set to false to see the browser window
  });
  
  try {
    // Test with protection ON
    console.log('\n--- Testing WITH Canvas Protection ---');
    
    // Create a browser context with protection
    const protectedContext = await browser.newContext();
    
    // Inject canvas spoofing
    await injectSpoofing(protectedContext, {
      config: {
        debug: true, // Enable debug mode to see logs
        pixelNoiseRange: 5, // Set noise range
      }
    });
    
    // Create a page and navigate to BrowserLeaks
    const protectedPage = await protectedContext.newPage();
    await protectedPage.goto('https://browserleaks.com/canvas');
    await protectedPage.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks with protection.');
    console.log('   Look for "Randomized" in the Canvas Test section.');
    console.log('   Take note of the hash values.');
    
    // Wait for examination
    console.log('   Waiting 15 seconds for examination...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Refresh the page to see if hash changes
    console.log('   Refreshing page to check for hash changes...');
    await protectedPage.reload();
    await protectedPage.waitForLoadState('networkidle');
    
    console.log('   Page refreshed. Check if the hash values have changed.');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test WebBrowserTools
    console.log('\nNavigating to WebBrowserTools Canvas Fingerprint Test...');
    await protectedPage.goto('https://webbrowsertools.com/canvas-fingerprint/');
    await protectedPage.waitForLoadState('networkidle');
    
    console.log('✅ Loaded WebBrowserTools with protection.');
    console.log('   Check if it detects canvas fingerprint spoofing.');
    
    // Wait for examination
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Test with protection OFF for comparison
    console.log('\n--- Testing WITHOUT Canvas Protection (for comparison) ---');
    
    // Create a browser context without protection
    const unprotectedContext = await browser.newContext();
    const unprotectedPage = await unprotectedContext.newPage();
    
    // Navigate to BrowserLeaks
    await unprotectedPage.goto('https://browserleaks.com/canvas');
    await unprotectedPage.waitForLoadState('networkidle');
    
    console.log('✅ Loaded BrowserLeaks without protection.');
    console.log('   Note that hash values should remain consistent when refreshing.');
    
    // Wait for examination
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Refresh the page to show hash consistency
    console.log('   Refreshing page to check hash consistency...');
    await unprotectedPage.reload();
    await unprotectedPage.waitForLoadState('networkidle');
    
    console.log('   Page refreshed. Hash values should remain the same.');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Clean up
    await protectedContext.close();
    await unprotectedContext.close();
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowserLeaks canvas test completed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testBrowserLeaks().catch(console.error);
}

module.exports = {
  testBrowserLeaks
};