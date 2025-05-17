/**
 * core.js - Core utilities for anti-fingerprinting modules
 * 
 * Provides:
 * - PRNG with configurable seeding
 * - Logging infrastructure
 * - Error handling with fallback capabilities
 * - Configuration constants
 */

// =====================================================================
// Configuration Constants
// =====================================================================

/**
 * Global debug mode - controls logging verbosity
 * @type {boolean}
 */
export const DEBUG_MODE = false;

/**
 * Spoofing behavior configuration
 * @type {Object}
 */
export const SPOOF_MODE = {
  // If true, silently fall back to native methods on error
  failSilently: true,
  // If true, log errors to console (regardless of DEBUG_MODE)
  logErrors: true,
  // If true, throw errors instead of falling back (breaks sites but easier to debug)
  hardBlock: false
};

// =====================================================================
// PRNG Implementation
// =====================================================================

/**
 * Creates a seeded PRNG based on Xorshift32 algorithm
 * 
 * @param {number} seed - Initial seed value
 * @returns {Object} PRNG object with various methods
 */
export function createPRNG(seed) {
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

// =====================================================================
// Logging Utilities
// =====================================================================

/**
 * Log message with prefix, but only if DEBUG_MODE is enabled
 * 
 * @param {string} module - Source module name
 * @param {string} message - Log message
 * @param {any} [data] - Optional data to log
 */
export function log(module, message, data) {
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
export function logError(module, error, context = '') {
  if (!SPOOF_MODE.logErrors) return;
  
  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[Obscura:${module}:ERROR ${timestamp}]`;
  
  if (context) {
    console.error(prefix, context, error);
  } else {
    console.error(prefix, error);
  }
}

// =====================================================================
// Error Handling and Fallback
// =====================================================================

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
export function tryOrFallback(nativeFn, spoofFn, context, args, moduleName) {
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
export function generateSessionSeed() {
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
// Canvas Transform Utilities
// =====================================================================

/**
 * Apply subtle transformations to canvas context
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prng - PRNG instance
 */
export function applyCanvasTransform(ctx, prng) {
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

// Export for module use
export default {
  DEBUG_MODE,
  SPOOF_MODE,
  createPRNG,
  log,
  logError,
  tryOrFallback,
  generateSessionSeed,
  applyCanvasTransform
};