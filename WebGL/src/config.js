// src/config.js

/**
 * Default configuration for WebGL fingerprinting protection
 */
const defaultConfig = {
  /**
   * Master switch to enable/disable the entire protection
   */
  enabled: true,

  /**
   * Profile selection settings
   */
  profile: {
    /**
     * Path to the webgl.json file (for Node.js environments)
     * Set to null for browser environments
     */
    profilePath: null,
    
    /**
     * Vendor preference (optional)
     * If set, will try to select profiles matching this vendor
     * Options: 'nvidia', 'amd', 'intel', null (random)
     */
    preferredVendor: null,
    
    /**
     * GPU tier preference (optional)
     * If set, will try to select profiles matching this tier
     * Options: 'high', 'mid', 'low', null (random)
     */
    preferredTier: null
  },

  /**
   * Parameter spoofing settings
   */
  parameters: {
    /**
     * Enable parameter spoofing
     */
    enabled: true,
    
    /**
     * Percentage to jitter numeric parameters (0.0 to 1.0)
     * 0.03 means values can vary by ±3%
     */
    jitterPercent: 0.03,
    
    /**
     * Apply different jitter ranges based on GPU tier
     */
    jitterByTier: {
      high: 0.02,  // High-end GPUs have less variation (±2%)
      mid: 0.03,   // Mid-range GPUs have medium variation (±3%)
      low: 0.05    // Low-end GPUs have more variation (±5%)
    }
  },

  /**
   * Extension spoofing settings
   */
  extensions: {
    /**
     * Enable extension spoofing
     */
    enabled: true,
    
    /**
     * Extensions to always block
     * These are typically used for fingerprinting
     */
    blockedExtensions: [
      "WEBGL_debug_renderer_info",
      "EXT_disjoint_timer_query",
      "EXT_disjoint_timer_query_webgl2"
    ]
  },

  /**
   * Draw call spoofing settings
   */
  drawCalls: {
    /**
     * Enable draw call spoofing (shader injection)
     * May impact performance of legitimate WebGL applications
     */
    enabled: false,
    
    /**
     * Noise amount for shader perturbation (0.0 to 1.0)
     * Higher values cause more visible distortion
     */
    noiseAmount: 0.02,
    
    /**
     * Noise granularity (smaller = more fine-grained noise)
     */
    noiseGranularity: 64
  },

  /**
   * Readback protection settings
   */
  readback: {
    /**
     * Enable readback protection (readPixels/toDataURL)
     */
    enabled: true,
    
    /**
     * Maximum pixel adjustment for noise (0 to 255)
     */
    pixelJitter: 3,
    
    /**
     * Apply noise to alpha channel
     */
    includeAlpha: false
  },

  /**
   * Debug settings
   */
  debug: {
    /**
     * Enable debug logging
     */
    enabled: false,
    
    /**
     * Log all intercepted WebGL calls
     */
    logCalls: false,
    
    /**
     * Log parameter values (before and after spoofing)
     */
    logParameters: false,
    
    /**
     * Add visual indicator when protection is active
     */
    visualIndicator: false
  }
};

/**
 * Configuration class for WebGL fingerprinting protection
 */
class Config {
  /**
   * Create a new Config instance
   * @param {Object} userConfig - User-provided configuration (will be merged with defaults)
   */
  constructor(userConfig = {}) {
    // Merge default config with user-provided config
    this.config = this._mergeConfigs(defaultConfig, userConfig);
    
    // Freeze the config to prevent changes after initialization
    Object.freeze(this.config);
  }

  /**
   * Merge configurations, handling nested objects
   * @private
   * @param {Object} defaultConfig - The default configuration
   * @param {Object} userConfig - The user-provided configuration
   * @returns {Object} The merged configuration
   */
  _mergeConfigs(defaultConfig, userConfig) {
    // Create a copy of the default config
    const result = JSON.parse(JSON.stringify(defaultConfig));
    
    // If user config is not an object, return default
    if (!userConfig || typeof userConfig !== 'object') {
      return result;
    }
    
    // Merge top-level properties
    for (const key in userConfig) {
      if (key in result) {
        // Handle nested objects
        if (typeof result[key] === 'object' && result[key] !== null && 
            typeof userConfig[key] === 'object' && userConfig[key] !== null) {
          result[key] = this._mergeConfigs(result[key], userConfig[key]);
        } else {
          // Overwrite with user value
          result[key] = userConfig[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Get the full configuration object
   * @returns {Object} The complete configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get a specific configuration value using dot notation
   * @param {string} path - The configuration path (e.g., 'parameters.jitterPercent')
   * @param {*} defaultValue - Default value if path doesn't exist
   * @returns {*} The configuration value
   */
  get(path, defaultValue) {
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || !(part in current)) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Check if a feature is enabled
   * @param {string} feature - The feature name ('parameters', 'extensions', etc.)
   * @returns {boolean} Whether the feature is enabled
   */
  isEnabled(feature) {
    // Check master switch first
    if (!this.config.enabled) {
      return false;
    }
    
    // Check feature-specific enabled flag
    if (feature && this.config[feature]) {
      return !!this.config[feature].enabled;
    }
    
    return false;
  }

  /**
   * Log a debug message if debug is enabled
   * @param {string} message - The message to log
   * @param {string} level - The log level ('log', 'warn', 'error')
   */
  log(message, level = 'log') {
    if (this.config.debug.enabled) {
      console[level](`[WebGL Fingerprint Protection] ${message}`);
    }
  }
}

module.exports = Config;