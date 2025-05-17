/**
 * bootstrap.js - Self-contained canvas anti-fingerprinting script
 * 
 * This script combines the functionality from core.js and canvas.js into
 * a single file that can be injected via Playwright's addInitScript.
 * It does not use ES module imports to ensure browser compatibility.
 */

(function() {
  // Prevent double-initialization
  if (window.__obscura_initialized) return;
  window.__obscura_initialized = true;
  
  // =====================================================================
  // Configuration Constants
  // =====================================================================
  
  const DEBUG_MODE = false;
  
  const SPOOF_MODE = {
    // If true, silently fall back to native methods on error
    failSilently: true,
    // If true, log errors to console (regardless of DEBUG_MODE)
    logErrors: true,
    // If true, throw errors instead of falling back (breaks sites but easier to debug)
    hardBlock: false
  };
  
  // =====================================================================
  // Utility Functions
  // =====================================================================
  
  /**
   * Log message with prefix, but only if DEBUG_MODE is enabled
   * 
   * @param {string} module - Source module name
   * @param {string} message - Log message
   * @param {any} [data] - Optional data to log
   */
  function log(module, message, data) {
    if (!DEBUG_MODE) return;
    
    const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const prefix = `[Obscura:${module} ${timestamp}]`;
    
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
  
  /**
   * Log an error, always shown if SPOOF_MODE.logErrors is true
   * 
   * @param {string} module - Source module name
   * @param {Error|string} error - Error object or message
   * @param {string} [context] - Additional context
   */
  function logError(module, error, context = '') {
    if (!SPOOF_MODE.logErrors) return;
    
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[Obscura:${module}:ERROR ${timestamp}]`;
    
    if (context) {
      console.error(prefix, context, error);
    } else {
      console.error(prefix, error);
    }
  }
  
  /**
   * Try to execute a function, fallback to native if it fails
   * 
   * @param {Function} nativeFn - Original browser function
   * @param {Function} spoofFn - Our spoofing function
   * @param {Object} context - 'this' context to apply
   * @param {Array} args - Arguments array
   * @param {string} moduleName - Source module name for logging
   * @returns {any} - Result of either spoofFn or nativeFn
   */
  function tryOrFallback(nativeFn, spoofFn, context, args, moduleName) {
    try {
      return spoofFn.apply(context, args);
    } catch (error) {
      logError(moduleName, error, 'Spoofing failed, falling back to native');
      
      if (SPOOF_MODE.hardBlock) {
        throw new Error(`[Obscura] Spoofing failed in ${moduleName} and hardBlock is enabled`);
      }
      
      // Fall back to native implementation
      return nativeFn.apply(context, args);
    }
  }
  
  /**
   * Generate a consistent but unique session seed from various entropy sources
   * 
   * @returns {number} A numeric seed for the session
   */
  function generateSessionSeed() {
    // Combine multiple sources of entropy
    const timestamp = Date.now();
    const randomValue = Math.random() * 1000000;
    
    // Use FNV-1a to hash these together
    let hash = 2166136261; // FNV offset basis
    
    // Mix in timestamp
    for (let i = 0; i < 8; i++) {
      const byte = (timestamp >> (i * 8)) & 0xFF;
      hash ^= byte;
      hash = Math.imul(hash, 16777619); // FNV prime
    }
    
    // Mix in random value
    const randomBytes = new Uint8Array(new Float64Array([randomValue]).buffer);
    for (let i = 0; i < randomBytes.length; i++) {
      hash ^= randomBytes[i];
      hash = Math.imul(hash, 16777619);
    }
    
    return hash >>> 0; // Convert to unsigned 32-bit integer
  }
  
  // =====================================================================
  // PRNG Implementation
  // =====================================================================
  
  /**
   * Creates a seeded PRNG based on Xorshift32 algorithm
   * 
   * @param {number} seed - Initial seed value
   * @returns {Object} PRNG object with various methods
   */
  function createPRNG(seed) {
    // Ensure seed is a valid number and non-zero
    if (!seed || isNaN(seed)) {
      seed = Date.now();
      if (DEBUG_MODE) {
        console.warn('Invalid PRNG seed provided, using timestamp:', seed);
      }
    }
    
    // Initialize state with the seed
    let state = seed >>> 0; // Convert to 32-bit unsigned integer
    
    // If state is 0, use a default value to avoid PRNG issues
    if (state === 0) state = 1;
    
    /**
     * Core xorshift32 algorithm
     * @returns {number} - Integer in range [0, 2^32-1]
     */
    function xorshift32() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0; // Convert to unsigned 32-bit integer
    }
    
    return {
      /**
       * Get the current seed/state
       * @returns {number} Current state
       */
      getState: () => state,
      
      /**
       * Generate float in range [0, 1)
       * @returns {number} Float between 0 (inclusive) and 1 (exclusive)
       */
      random: () => {
        return xorshift32() / 4294967296; // Divide by 2^32
      },
      
      /**
       * Generate integer in range [min, max] (inclusive)
       * @param {number} min - Minimum value (inclusive)
       * @param {number} max - Maximum value (inclusive)
       * @returns {number} Integer between min and max (inclusive)
       */
      randomInt: (min, max) => {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(xorshift32() / 4294967296 * (max - min + 1)) + min;
      },
      
      /**
       * Generate float in range [min, max)
       * @param {number} min - Minimum value (inclusive)
       * @param {number} max - Maximum value (exclusive)
       * @returns {number} Float between min (inclusive) and max (exclusive)
       */
      randomRange: (min, max) => {
        return min + (xorshift32() / 4294967296) * (max - min);
      },
      
      /**
       * FNV-1a hash implementation for consistent string-to-number mapping
       * @param {string} str - String to hash
       * @returns {number} Hash value
       */
      hash: (str) => {
        // FNV constants for 32-bit
        const FNV_PRIME = 16777619;
        const OFFSET_BASIS = 2166136261;
        
        let hash = OFFSET_BASIS;
        
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash = Math.imul(hash, FNV_PRIME);
        }
        
        return hash >>> 0; // Convert to unsigned int
      }
    };
  }
  
  /**
   * Apply subtle transformations to canvas context
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} prng - PRNG instance
   */
  function applyCanvasTransform(ctx, prng) {
    // Get consistent but unique transform values for this canvas
    const scaleX = 1 + prng.randomRange(-0.002, 0.002);
    const scaleY = 1 + prng.randomRange(-0.002, 0.002);
    const translateX = prng.randomRange(-0.3, 0.3);
    const translateY = prng.randomRange(-0.3, 0.3);
    const rotate = prng.randomRange(-0.002, 0.002);
    
    if (DEBUG_MODE) {
      log('canvas', 'Applying transform', {
        scaleX, scaleY, translateX, translateY, rotate
      });
    }
    
    // Apply transformations
    ctx.translate(translateX, translateY);
    ctx.rotate(rotate);
    ctx.scale(scaleX, scaleY);
  }
  
  // =====================================================================
  // Canvas Spoofing Implementation
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
  
  // Canvas spoofing configuration
  const canvasConfig = {
    // Noise range for pixel manipulation
    pixelNoiseRange: 5,
    // Alpha channel noise range (only for fully opaque pixels)
    alphaNoiseRange: 3,
    // Canvas transform settings are defined in applyCanvasTransform
  };
  
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
    const pixelNoiseRange = canvasConfig.pixelNoiseRange;
    const alphaNoiseRange = canvasConfig.alphaNoiseRange;
    
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
  
  /**
   * Initialize the canvas fingerprinting protection
   * 
   * @param {number} [seed] - Session seed (optional, auto-generated if not provided)
   * @param {Object} [options] - Configuration options
   */
  function init(seed = null, options = {}) {
    // Use provided seed or generate a new one
    sessionSeed = seed || generateSessionSeed();
    
    // Initialize PRNG with the seed
    prng = createPRNG(sessionSeed);
    
    // Merge configuration options
    Object.assign(canvasConfig, options);
    
    if (DEBUG_MODE) {
      log('canvas', 'Initialized with seed:', sessionSeed);
      log('canvas', 'Configuration:', canvasConfig);
    }
    
    return {
      patch,
      unpatch,
      getStatus: () => ({
        isPatched,
        sessionSeed,
        config: canvasConfig
      })
    };
  }
  
  /**
   * Patch canvas methods to prevent fingerprinting
   * 
   * @returns {boolean} True if patching was successful
   */
  function patch() {
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
  function unpatch() {
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
  
  // =====================================================================
  // Public Interface
  // =====================================================================
  
  // Expose the API for manual control, if needed
  window.__obscura = {
    init,
    patch,
    unpatch,
    getStatus: () => ({
      isPatched,
      sessionSeed,
      DEBUG_MODE,
      SPOOF_MODE
    })
  };
  
  // Auto-initialize with a random seed and patch immediately
  // This can be customized if needed
  init();
  patch();
  
  if (DEBUG_MODE) {
    log('bootstrap', 'Canvas fingerprinting protection initialized and activated');
    log('bootstrap', 'Session seed:', sessionSeed);
  }
})();
