// examples/playwright-example.js

const { chromium } = require('playwright');
const path = require('path');
const { createPreloadScript } = require('../src/index');

async function runExample() {
  // Configuration for WebGL fingerprinting protection
  const config = {
    enabled: true,
    parameters: {
      jitterPercent: 0.03
    },
    extensions: {
      blockedExtensions: [
        "WEBGL_debug_renderer_info",
        "EXT_disjoint_timer_query",
        "EXT_disjoint_timer_query_webgl2"
      ]
    },
    drawCalls: {
      enabled: true,
      noiseAmount: 0.02
    },
    readback: {
      enabled: true,
      pixelJitter: 3
    },
    debug: {
      enabled: true
    }
  };

  // Create browser
  const browser = await chromium.launch({
    headless: false
  });

  // Create context with preload script
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  // Add initialization script
  await context.addInitScript({
    path: path.join(__dirname, '../dist/webgl-protection.js')
  });

  // Configure protection
  await context.addInitScript(createPreloadScript(config));

  // Create page
  const page = await context.newPage();

  // Navigate to a fingerprinting test site
  await page.goto('https://fingerprintjs.github.io/fingerprintjs/');

  // Wait for results
  await page.waitForSelector('.fp-result');

  // Get fingerprint values
  const fingerprintValue = await page.evaluate(() => {
    return document.querySelector('.fp-value').textContent;
  });

  console.log('Fingerprint value:', fingerprintValue);

  // Wait a bit to observe the page
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close browser
  await browser.close();
}

runExample().catch(console.error);