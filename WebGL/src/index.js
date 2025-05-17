// src/index.js

/**
 * WebGL Fingerprinting Protection
 * Main integration module that coordinates all protection mechanisms
 */

const SessionPRNG = require('./prng');
const ProfileManager = require('./profileManager');
const Config = require('./config');
const { installParameterSpoofing } = require('./spoofing/parameterSpoof');
const { installExtensionSpoofing } = require('./spoofing/extensionSpoof');
const { installDrawSpoofing } = require('./spoofing/drawSpoof');
const { installReadbackSpoofing, applyNoiseToDataURL } = require('./spoofing/readbackSpoof');

// Store instances to prevent reinitializing
let initialized = false;
let config = null;
let prng = null;
let profileManager = null;
let activeProfile = null;

/**
 * Initialize the WebGL fingerprinting protection
 * @param {Object} userConfig - User-provided configuration options
 * @returns {Promise<Object>} Configuration and API methods
 */
async function initialize(userConfig = {}) {
  // Skip if already initialized
  if (initialized) {
    return {
      config,
      prng,
      disable,
      getStatus
    };
  }

  // Create configuration with user options
  config = new Config(userConfig);

  // Initialize PRNG with optional seed
  const seed = config.get('seed');
  prng = new SessionPRNG(seed);

  // Initialize profile manager
  profileManager = new ProfileManager({
    profilePath: config.get('profile.profilePath')
  });

  // Select a profile based on preferences
  const preferredVendor = config.get('profile.preferredVendor');
  const preferredTier = config.get('profile.preferredTier');
  
  try {
    activeProfile = await profileManager.selectProfile(prng);
    
    // Log the selected profile for debugging
    if (config.get('debug.enabled')) {
      config.log(`Selected profile: ${activeProfile.gpuVendor} ${activeProfile.gpuTier} (${activeProfile.unmaskedRenderer})`);
    }
  } catch (error) {
    config.log(`Error selecting profile: ${error.message}`, 'error');
    return { error: 'Failed to initialize WebGL fingerprinting protection' };
  }

  // Hook canvas getContext to intercept WebGL context creation
  installContextHook();

  // Mark as initialized
  initialized = true;

  // Return API
  return {
    config,
    prng,
    disable,
    getStatus
  };
}

/**
 * Install hook for canvas.getContext to intercept WebGL context creation
 */
function installContextHook() {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
    // Get original context
    const context = originalGetContext.call(this, contextType, ...args);

    // Skip if context creation failed or protection is disabled
    if (!context || !config.get('enabled')) {
      return context;
    }

    // Apply WebGL spoofing if this is a WebGL context
    if (contextType === 'webgl' || contextType === 'experimental-webgl' || contextType === 'webgl2') {
      // Create shared state object for cross-module communication
      const state = {
        noiseApplied: false
      };

      // Apply spoofing modules
      applyWebGLSpoofing(context, contextType, state);

      // Visual indicator for debugging
      if (config.get('debug.visualIndicator')) {
        addVisualIndicator(this);
      }

      // Log context creation
      config.log(`WebGL context spoofed: ${contextType}`);
    }

    return context;
  };
}

/**
 * Apply WebGL fingerprinting protection to a context
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context
 * @param {string} contextType - The context type ('webgl', 'webgl2', etc.)
 * @param {Object} state - Shared state for cross-module communication
 */
function applyWebGLSpoofing(gl, contextType, state) {
  // Skip if not initialized
  if (!initialized || !activeProfile) {
    return;
  }

  // Determine if this is a WebGL2 context
  const isWebGL2 = contextType === 'webgl2';

  // Skip WebGL2 if profile doesn't support it
  if (isWebGL2 && !activeProfile.supportsWebGL2) {
    config.log('Skipping WebGL2 spoofing (profile does not support WebGL2)', 'warn');
    return;
  }

  // Apply spoofing modules in order
  if (config.isEnabled('parameters')) {
    installParameterSpoofing(gl, activeProfile, prng, config);
  }

  if (config.isEnabled('extensions')) {
    installExtensionSpoofing(gl, activeProfile, prng, config);
  }

  if (config.isEnabled('drawCalls')) {
    installDrawSpoofing(gl, activeProfile, prng, config, state);
  }

  if (config.isEnabled('readback')) {
    installReadbackSpoofing(gl, activeProfile, prng, config, state);
  }
}

/**
 * Add a visual indicator to a canvas for debugging
 * @param {HTMLCanvasElement} canvas - The canvas element
 */
function addVisualIndicator(canvas) {
  // Add a small colored border to indicate protection is active
  canvas.style.outline = '2px solid rgba(0, 128, 255, 0.5)';
  canvas.setAttribute('data-webgl-protected', 'true');
}

/**
 * Disable WebGL fingerprinting protection
 */
function disable() {
  if (!initialized) {
    return false;
  }

  try {
    // Restore original getContext method
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    
    // Mark as uninitialized
    initialized = false;
    
    return true;
  } catch (error) {
    config.log(`Error disabling protection: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Get current status of the WebGL fingerprinting protection
 * @returns {Object} Status information
 */
function getStatus() {
  return {
    initialized,
    enabled: initialized && config.get('enabled'),
    profile: activeProfile ? {
      vendor: activeProfile.gpuVendor,
      tier: activeProfile.gpuTier,
      webgl2Support: activeProfile.supportsWebGL2
    } : null,
    config: config ? config.getConfig() : null
  };
}

/**
 * Create a browser preload script for use with Playwright/Puppeteer
 * @param {Object} userConfig - User configuration options
 * @returns {string} JavaScript code to use as preload script
 */
function createPreloadScript(userConfig = {}) {
  // Bundle all required code into a single script
  // This is a simplified version - in reality, this would require bundling all dependencies
  return `
    // WebGL Fingerprinting Protection Preload Script
    (function() {
      // Configuration
      const config = ${JSON.stringify(userConfig)};
      
      // Initialization code would be bundled here
      // ...
      
      // Main hook
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
        const context = originalGetContext.call(this, contextType, ...args);
        if (context && (contextType === 'webgl' || contextType === 'experimental-webgl' || contextType === 'webgl2')) {
          // Apply spoofing (simplified)
          console.log('WebGL Fingerprinting Protection active');
        }
        return context;
      };
    })();
  `;
}

// Export public API
module.exports = {
  initialize,
  disable,
  getStatus,
  createPreloadScript,
  applyNoiseToDataURL
};

// Add browser-compatible initialization
if (typeof window !== 'undefined') {
  window.enableWebGLProtection = async function(userConfig = {}) {
    return await initialize(userConfig || window._webglProtectionConfig || {});
  };

  // Auto-initialize if config is present
  if (window._webglProtectionConfig) {
    setTimeout(() => {
      window.enableWebGLProtection(window._webglProtectionConfig)
        .then(result => {
          console.log('WebGL Protection initialized:', result);
        })
        .catch(error => {
          console.error('WebGL Protection initialization failed:', error);
        });
    }, 0);
  }
}