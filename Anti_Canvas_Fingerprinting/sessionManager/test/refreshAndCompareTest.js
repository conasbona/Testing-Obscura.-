/**
 * refreshAndCompareTest.js - Tests canvas fingerprinting by refreshing in the same instance
 * 
 * This script loads browserleaks.com/canvas, captures the canvas hash,
 * then refreshes the page to check if the hash changes with our protection.
 */

const { firefox } = require('playwright');
const { injectSpoofing } = require('../injectSpoofing');

/**
 * Runs a test that refreshes the same page to compare fingerprints
 */
async function runRefreshTest() {
  console.log('Starting canvas fingerprint refresh test...');
  
  // Launch Firefox browser
  const browser = await firefox.launch({
    headless: false,
  });
  
  try {
    // Test with protection ON
    console.log('\n--- Testing WITH Canvas Protection ---');
    
    // Create a browser context with protection
    const protectedContext = await browser.newContext();
    
    // Inject canvas spoofing
    const result = await injectSpoofing(protectedContext, {
      config: {
        debug: true,
      }
    });
    console.log('Protection active with seed:', result.seed);
    
    // Create a page and navigate to BrowserLeaks
    const page = await protectedContext.newPage();
    await page.goto('https://browserleaks.com/canvas');
    await page.waitForLoadState('networkidle');
    
    console.log('\n✅ Loaded BrowserLeaks with protection');
    console.log('   Please check the Canvas Hash Signature');
    
    // Script to extract the canvas hash from the page
    const extractCanvasHash = async () => {
      try {
        return await page.evaluate(() => {
          const hashElement = document.querySelector('table.table-sm tr:nth-child(2) td:nth-child(2)');
          return hashElement ? hashElement.textContent.trim() : null;
        });
      } catch (e) {
        return "Unable to extract hash";
      }
    };
    
    // Get initial hash
    const initialHash = await extractCanvasHash();
    console.log(`   Initial Canvas Hash: ${initialHash}`);
    
    // Wait a moment
    console.log('   Waiting 5 seconds before refreshing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Refresh the page
    console.log('   Refreshing page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Get new hash after refresh
    const newHash = await extractCanvasHash();
    console.log(`   New Canvas Hash: ${newHash}`);
    
    // Compare hashes
    if (initialHash !== newHash) {
      console.log('✅ SUCCESS: Canvas hash changed after refresh!');
      console.log('   This indicates the fingerprinting protection is working.');
    } else {
      console.log('❌ FAILURE: Canvas hash remained the same after refresh.');
      console.log('   This indicates the fingerprinting protection may not be working properly.');
    }
    
    // Keep the browser open for manual inspection
    console.log('\nBrowser will remain open for 30 seconds for manual inspection...');
    console.log('Try refreshing the page a few more times to verify the hash changes.');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
    console.log('\nCanvas fingerprint refresh test completed.');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runRefreshTest().catch(console.error);
}

module.exports = {
  runRefreshTest
};