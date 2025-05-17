/**
 * injectSpoofing.js - Injects anti-fingerprinting scripts into Playwright browser contexts
 * 
 * This module provides functions to inject anti-fingerprinting protections
 * into Playwright browser contexts. It handles script injection and
 * configuration management with a clean separation of concerns.
 * 
 * Location: sessionManager/injectSpoofing.js
 */

const fs = require('fs');
const path = require('path');

// =====================================================================
// Configuration and Constants
// =====================================================================

// Paths to spoofing scripts
const SCRIPT_PATHS = {
  bootstrap: path.join(__dirname, '../spoofing/bootstrap.js'),
  // Future scripts can be added here
  // webgl: path.join(__dirname, '../../spoofing/webgl-bootstrap.js'),
};

// =====================================================================
// Helper Functions
// =====================================================================

/**
 * Generates a deterministic session seed from various inputs
 * 
 * @param {string} [identifier] - Optional identifier string
 * @returns {number} A numeric seed for spoofing
 */
function generateSeed(identifier = '') {
  // Combine timestamp with optional identifier
  const base = Date.now().toString() + identifier;
  
  // Simple FNV-1a hash implementation
  let hash = 2166136261; // FNV offset basis
  
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Reads a script file from disk
 * 
 * @param {string} scriptPath - Path to the script file
 * @returns {string} Script content
 * @throws {Error} If file cannot be read
 */
function readScriptFile(scriptPath) {
  try {
    return fs.readFileSync(scriptPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read script file ${scriptPath}: ${error.message}`);
  }
}

// =====================================================================
// Main Module Functions
// =====================================================================

/**
 * Injects canvas anti-fingerprinting protection into a Playwright browser context
 * 
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @param {Object} [config] - Configuration options
 * @param {number} [config.seed] - Specific seed to use (optional)
 * @param {boolean} [config.debug] - Enable debug mode
 * @param {boolean} [config.failSilently] - Fall back to native methods on error
 * @param {boolean} [config.logErrors] - Log errors to console
 * @param {boolean} [config.hardBlock] - Throw errors instead of falling back
 * @param {number} [config.pixelNoiseRange] - Range for pixel noise
 * @param {number} [config.alphaNoiseRange] - Range for alpha noise
 * @returns {Promise<Object>} Injection result with metadata
 */
async function injectCanvasSpoofing(context, config = {}) {
  // Generate a seed if not provided
  const seed = config.seed !== undefined ? config.seed : generateSeed();
  
  // Update config with seed
  const fullConfig = {
    ...config,
    seed
  };
  
  try {
    // First, inject the configuration object if we have custom settings
    if (Object.keys(fullConfig).length > 0) {
      await context.addInitScript({
        content: `window.__obscura_config = ${JSON.stringify({ canvas: fullConfig })};`
      });
    }
    
    // Then, read and inject the bootstrap script
    const bootstrapContent = readScriptFile(SCRIPT_PATHS.bootstrap);
    await context.addInitScript({
      content: bootstrapContent
    });
    
    return {
      success: true,
      seed,
      type: 'canvas'
    };
  } catch (error) {
    throw new Error(`Failed to inject canvas spoofing: ${error.message}`);
  }
}

/**
 * Main function to inject all specified anti-fingerprinting protections
 * 
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @param {Object} [options] - Configuration options
 * @param {string[]} [options.protections=['canvas']] - List of protections to inject
 * @param {Object} [options.config] - Configuration for the protections
 * @returns {Promise<Object>} Injection results
 */
async function injectSpoofing(context, options = {}) {
  // Default to canvas protection only
  const protections = options.protections || ['canvas'];
  const config = options.config || {};
  
  // Generate a common seed for all protections if not specified
  const seed = config.seed !== undefined ? config.seed : generateSeed();
  
  const results = {
    seed,
    injected: []
  };
  
  // Apply requested protections
  for (const protection of protections) {
    switch (protection) {
      case 'canvas':
        try {
          const result = await injectCanvasSpoofing(context, {
            ...config,
            seed
          });
          results.injected.push(result);
        } catch (error) {
          console.error(`Failed to inject ${protection} protection:`, error);
          results.errors = results.errors || [];
          results.errors.push({
            protection,
            error: error.message
          });
        }
        break;
        
      // Future protections can be added here
      // case 'webgl':
      //   await injectWebGLSpoofing(context, { ...config, seed });
      //   break;
        
      default:
        console.warn(`Unknown protection type: ${protection}`);
        break;
    }
  }
  
  return results;
}

// Export the module functions
module.exports = {
  injectSpoofing,
  injectCanvasSpoofing,
  generateSeed
};