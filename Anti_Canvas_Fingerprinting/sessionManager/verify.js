/**
 * verify.js - Test utilities for verifying anti-fingerprinting functionality
 * 
 * This module provides utility functions to verify that anti-fingerprinting
 * protections are correctly applied and functioning in a Playwright page.
 * 
 * Location: sessionManager/verify.js
 */

/**
 * Verifies that canvas anti-fingerprinting is working by running test code in the page
 * 
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<Object>} Verification results
 */
async function verifyCanvasSpoofing(page) {
  // Simple verification: check if the __obscura object exists
  const hasObscura = await page.evaluate(() => {
    return typeof window.__obscura !== 'undefined';
  });
  
  if (!hasObscura) {
    return {
      success: false,
      reason: 'Obscura object not found in window context'
    };
  }
  
  // Check if canvas fingerprinting protection is active
  const status = await page.evaluate(() => {
    return window.__obscura.getStatus();
  });
  
  // Test fingerprinting by drawing something and getting its data URL twice
  const fingerprintTest = await page.evaluate(() => {
    // Create a test canvas
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    // Draw some text (common fingerprinting technique)
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint Test', 2, 2);
    
    // Get data URL twice and compare
    const first = canvas.toDataURL();
    const second = canvas.toDataURL();
    
    return {
      different: first !== second,
      first: first.substring(0, 100) + '...',
      second: second.substring(0, 100) + '...'
    };
  });
  
  return {
    success: status.isPatched,
    active: status.isPatched,
    seed: status.sessionSeed,
    fingerprintTest,
    debugMode: status.DEBUG_MODE
  };
}

/**
 * Runs a simple canvas fingerprinting test and checks if results differ across contexts
 * 
 * @param {import('playwright').Browser} browser - Playwright browser
 * @returns {Promise<Object>} Test results
 */
async function testCanvasFingerprinting(browser) {
  // Create two separate browser contexts
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  // Create a page in each context
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // Load a blank page in both
  await page1.goto('about:blank');
  await page2.goto('about:blank');
  
  // Draw identical content on canvases in both pages
  const getCanvasFingerprint = async (page) => {
    return page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      
      // Common fingerprinting techniques
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.font = '11pt Arial';
      ctx.fillText('Fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.font = '18pt Arial';
      ctx.fillText('Test', 4, 45);
      
      return canvas.toDataURL();
    });
  };
  
  const fingerprint1 = await getCanvasFingerprint(page1);
  const fingerprint2 = await getCanvasFingerprint(page2);
  
  // Clean up
  await context1.close();
  await context2.close();
  
  return {
    different: fingerprint1 !== fingerprint2,
    similarity: calculateSimilarity(fingerprint1, fingerprint2)
  };
}

/**
 * Calculate a simple similarity score between two strings
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  // Simple check for identical strings
  if (str1 === str2) return 1.0;
  
  // Truncate to same length
  const minLength = Math.min(str1.length, str2.length);
  str1 = str1.substring(0, minLength);
  str2 = str2.substring(0, minLength);
  
  // Count matching characters
  let matches = 0;
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / minLength;
}

module.exports = {
  verifyCanvasSpoofing,
  testCanvasFingerprinting
};