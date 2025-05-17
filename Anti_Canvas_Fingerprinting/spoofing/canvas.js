/**
 * canvas.js - Canvas fingerprinting protection module
 * 
 * Provides methods to prevent canvas fingerprinting by applying subtle
 * modifications to canvas outputs, making them unique per session while
 * maintaining visual integrity.
 * 
 * Targets:
 * - CanvasRenderingContext2D.prototype.getImageData
 * - HTMLCanvasElement.prototype.toDataURL
 * - HTMLCanvasElement.prototype.getContext
 */

import {
  createPRNG,
  log,
  logError,
  tryOrFallback,
  SPOOF_MODE,
  DEBUG_MODE,
  applyCanvasTransform,
  generateSessionSeed
} from './core.js';

// =====================================================================
// Module State
// =====================================================================

// Store original methods to restore them if needed
const originalMethods = {
  getImageData: null,
  toDataURL: null,
  getContext: null
};

// Module state
let prng = null;
let sessionSeed = null;
let isPatched = false;
let config = {
  // Noise range for pixel manipulation
  pixelNoiseRange: 5,
  // Alpha channel noise range (only for fully opaque pixels)
  alphaNoiseRange: 3,
  // Canvas transform settings are in core.js
};

// =====================================================================
// Initialization
// =====================================================================

/**
 * Initialize the canvas fingerprinting protection module
 * 
 * @param {number} [seed] - Session seed (optional, auto-generated if not provided)
 * @param {Object} [options] - Configuration options
 * @returns {Object} Module instance
 */
export function init(seed = null, options = {}) {
  // Use provided seed or generate a new one
  sessionSeed = seed || generateSessionSeed();
  
  // Initialize PRNG with the seed
  prng = createPRNG(sessionSeed);
  
  // Merge configuration options
  config = {
    ...config,
    ...options
  };
  
  if (DEBUG_MODE) {
    log('canvas', 'Initialized with seed:', sessionSeed);
    log('canvas', 'Configuration:', config);
  }
  
  return {
    patch,
    unpatch,
    getStatus: () => ({
      isPatched,
      sessionSeed,
      config
    })
  };
}

// =====================================================================
// Canvas API Spoofing Functions
// =====================================================================

/**
 * Spoofed implementation of getImageData that adds noise to pixel data
 * 
 * @param {Function} originalFn - Original getImageData function
 * @param {number} sx - Source x coordinate
 * @param {number} sy - Source y coordinate
 * @param {number} sw - Source width
 * @param {number} sh - Source height
 * @returns {ImageData} Modified image data
 */
function spoofGetImageData(originalFn, sx, sy, sw, sh) {
  // Call the original method to get the actual image data
  const imageData = originalFn.call(this, sx, sy, sw, sh);
  
  if (DEBUG_MODE) {
    log('canvas', 'Spoofing getImageData', { sx, sy, sw, sh });
  }
  
  // Get a deterministic but unique hash for this specific canvas content
  // We'll use canvas dimensions and a sample of pixels to create a content fingerprint
  const canvasEl = this.canvas;
  const contentFingerprint = `${canvasEl.width}x${canvasEl.height}:${imageData.data[0]}${imageData.data[100]}${imageData.data[1000]}`;
  const contentHash = prng.hash(contentFingerprint);
  
  // Create a content-specific PRNG
  const contentPRNG = createPRNG(sessionSeed ^ contentHash);
  
  // Apply subtle noise to the image data
  const { data } = imageData;
  const pixelNoiseRange = config.pixelNoiseRange;
  const alphaNoiseRange = config.alphaNoiseRange;
  
  for (let i = 0; i < data.length; i += 4) {
    // Generate deterministic noise values for RGB channels
    const rNoise = contentPRNG.randomInt(-pixelNoiseRange, pixelNoiseRange);
    const gNoise = contentPRNG.randomInt(-pixelNoiseRange, pixelNoiseRange);
    const bNoise = contentPRNG.randomInt(-pixelNoiseRange, pixelNoiseRange);
    
    // Apply noise to RGB channels with bounds checking
    data[i] = Math.max(0, Math.min(255, data[i] + rNoise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + gNoise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + bNoise));
    
    // Only apply alpha noise to fully opaque pixels
    if (data[i + 3] === 255) {
      // Generate a small noise value for alpha, but keep it close to 255
      const aNoise = contentPRNG.randomInt(0, alphaNoiseRange);
      data[i + 3] = 255 - aNoise;
    }
  }
  
  return imageData;
}

/**
 * Spoofed implementation of toDataURL that applies transformations
 * 
 * @param {Function} originalFn - Original toDataURL function
 * @param {string} [type] - Image format (e.g., "image/png")
 * @param {number} [quality] - Image quality for lossy formats
 * @returns {string} Modified data URL
 */
function spoofToDataURL(originalFn, type, quality) {
  if (DEBUG_MODE) {
    log('canvas', 'Spoofing toDataURL', { type, quality });
  }
  
  const canvasEl = this;
  
  // Create a temporary canvas to apply transformations
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasEl.width;
  tempCanvas.height = canvasEl.height;
  
  // Get the 2D context of the temporary canvas
  const tempCtx = tempCanvas.getContext('2d');
  
  // Save the state, apply transformations, and restore
  tempCtx.save();
  
  // Apply the subtle transformations
  applyCanvasTransform(tempCtx, prng);
  
  // Draw the original canvas onto the temporary one
  tempCtx.drawImage(canvasEl, 0, 0);
  
  // Restore the context state
  tempCtx.restore();
  
  // Call the original toDataURL on the temporary canvas
  return originalFn.call(tempCanvas, type, quality);
}

/**
 * Spoofed implementation of getContext that injects transformations
 * 
 * @param {Function} originalFn - Original getContext function
 * @param {string} contextType - Context type (e.g., "2d")
 * @param {Object} [contextAttributes] - Context attributes
 * @returns {RenderingContext} Canvas rendering context
 */
function spoofGetContext(originalFn, contextType, contextAttributes) {
  // Only modify 2d contexts for now
  if (contextType !== '2d') {
    return originalFn.call(this, contextType, contextAttributes);
  }
  
  if (DEBUG_MODE) {
    log('canvas', 'Spoofing getContext', { contextType, contextAttributes });
  }
  
  // Get the original context
  const ctx = originalFn.call(this, contextType, contextAttributes);
  
  // If we already processed this context, return it
  if (ctx.__obscura_processed) {
    return ctx;
  }
  
  // Mark this context as processed to avoid infinite recursion
  ctx.__obscura_processed = true;
  
  // Store original methods
  const originalGetImageData = ctx.getImageData;
  
  // Replace getImageData with our spoofed version
  ctx.getImageData = function(sx, sy, sw, sh) {
    return tryOrFallback(
      originalGetImageData,
      function() {
        return spoofGetImageData.call(this, originalGetImageData, sx, sy, sw, sh);
      },
      this,
      [sx, sy, sw, sh],
      'canvas.getImageData'
    );
  };
  
  return ctx;
}

// =====================================================================
// API Patching
// =====================================================================

/**
 * Patch canvas methods to prevent fingerprinting
 * 
 * @returns {boolean} True if patching was successful
 */
export function patch() {
  if (isPatched) {
    log('canvas', 'Already patched, skipping');
    return true;
  }
  
  try {
    // Store original methods
    originalMethods.getImageData = CanvasRenderingContext2D.prototype.getImageData;
    originalMethods.toDataURL = HTMLCanvasElement.prototype.toDataURL;
    originalMethods.getContext = HTMLCanvasElement.prototype.getContext;
    
    // Replace with spoofed versions
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      return tryOrFallback(
        originalMethods.getImageData,
        function() {
          return spoofGetImageData.call(this, originalMethods.getImageData, sx, sy, sw, sh);
        },
        this,
        [sx, sy, sw, sh],
        'canvas.getImageData'
      );
    };
    
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      return tryOrFallback(
        originalMethods.toDataURL,
        function() {
          return spoofToDataURL.call(this, originalMethods.toDataURL, type, quality);
        },
        this,
        [type, quality],
        'canvas.toDataURL'
      );
    };
    
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
      return tryOrFallback(
        originalMethods.getContext,
        function() {
          return spoofGetContext.call(this, originalMethods.getContext, contextType, contextAttributes);
        },
        this,
        [contextType, contextAttributes],
        'canvas.getContext'
      );
    };
    
    isPatched = true;
    
    if (DEBUG_MODE) {
      log('canvas', 'Successfully patched canvas fingerprinting APIs');
    }
    
    return true;
  } catch (error) {
    logError('canvas', error, 'Failed to patch canvas APIs');
    isPatched = false;
    return false;
  }
}

/**
 * Restore original canvas methods
 * 
 * @returns {boolean} True if unpatching was successful
 */
export function unpatch() {
  if (!isPatched) {
    log('canvas', 'Not patched, nothing to unpatch');
    return true;
  }
  
  try {
    // Restore original methods
    CanvasRenderingContext2D.prototype.getImageData = originalMethods.getImageData;
    HTMLCanvasElement.prototype.toDataURL = originalMethods.toDataURL;
    HTMLCanvasElement.prototype.getContext = originalMethods.getContext;
    
    isPatched = false;
    
    if (DEBUG_MODE) {
      log('canvas', 'Successfully unpatched canvas fingerprinting APIs');
    }
    
    return true;
  } catch (error) {
    logError('canvas', error, 'Failed to unpatch canvas APIs');
    return false;
  }
}

// Initialize module if this script is run directly
if (typeof window !== 'undefined' && !window.__obscura_canvas_initialized) {
  window.__obscura_canvas_initialized = true;
  init();
  patch();
  
  if (DEBUG_MODE) {
    log('canvas', 'Auto-initialized and patched canvas protection');
  }
}

// Export for module use
export default {
  init,
  patch,
  unpatch
};
