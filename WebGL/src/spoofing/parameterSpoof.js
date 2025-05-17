// src/spoofing/parameterSpoof.js

/**
 * Parameter spoofing module for WebGL fingerprinting protection
 * Intercepts and modifies getParameter() and getShaderPrecisionFormat() calls
 */

/**
 * Install parameter spoofing for a WebGL context
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context
 * @param {Object} profile - The selected GPU profile
 * @param {Object} prng - The PRNG instance
 * @param {Object} config - The configuration object
 * @returns {boolean} True if spoofing was installed
 */
function installParameterSpoofing(gl, profile, prng, config) {
  if (!gl || !profile || !prng || !config) {
    return false;
  }

  // Check if spoofing is enabled
  if (!config.isEnabled('parameters')) {
    return false;
  }

  // Determine if this is a WebGL2 context
  const isWebGL2 = !!gl.createQuery;

  // Create parameter cache to ensure consistent values
  const parameterCache = new Map();

  // Store original methods
  const originalGetParameter = gl.getParameter;
  const originalGetShaderPrecisionFormat = gl.getShaderPrecisionFormat;

  // Get jitter percentage based on GPU tier
  const jitterPercent = config.get(`parameters.jitterByTier.${profile.gpuTier}`, 
                                   config.get('parameters.jitterPercent', 0.03));

  // Constants for WEBGL_debug_renderer_info extension
  const UNMASKED_VENDOR_WEBGL = 0x9245;
  const UNMASKED_RENDERER_WEBGL = 0x9246;

  /**
   * Apply consistent jitter to a numeric value
   * @param {number} value - The base value
   * @param {string} paramName - The parameter name or key
   * @returns {number} The jittered value
   */
  function applyJitter(value, paramName) {
    if (typeof value !== 'number' || jitterPercent <= 0) {
      return value;
    }

    // Create a parameter-specific sub-PRNG
    const paramPrng = prng.deriveGenerator(`param-${paramName}`);
    
    // Generate jitter factor between -jitterPercent and +jitterPercent
    const jitterFactor = 1 + (paramPrng.random() * 2 - 1) * jitterPercent;
    
    // Apply jitter and round to nearest integer if original value was an integer
    const jitteredValue = value * jitterFactor;
    return Number.isInteger(value) ? Math.floor(jitteredValue) : jitteredValue;
  }

  /**
   * Apply jitter to array values
   * @param {Array} array - The array to jitter
   * @param {string} paramName - The parameter name
   * @returns {Array} The jittered array
   */
  function applyJitterToArray(array, paramName) {
    if (!Array.isArray(array)) {
      return array;
    }

    return array.map((value, index) => {
      return applyJitter(value, `${paramName}[${index}]`);
    });
  }

  /**
   * Override getParameter method
   * @param {number} pname - The parameter name (GL enum)
   * @returns {*} The parameter value
   */
  gl.getParameter = function(pname) {
    // Convert pname to string for cache key and logging
    const pnameStr = pname.toString();
    
    // Check cache first for consistency
    if (parameterCache.has(pnameStr)) {
      return parameterCache.get(pnameStr);
    }

    // Debug logging
    if (config.get('debug.logParameters')) {
      const origValue = originalGetParameter.call(this, pname);
      config.log(`getParameter(${pnameStr}) original: ${JSON.stringify(origValue)}`);
    }

    let result;

    // Handle WEBGL_debug_renderer_info parameters
    if (pname === UNMASKED_VENDOR_WEBGL) {
      result = profile.unmaskedVendor;
    } 
    else if (pname === UNMASKED_RENDERER_WEBGL) {
      result = profile.unmaskedRenderer;
    }
    // Handle standard parameters
    else if (pname === this.VENDOR) {
      result = profile.vendor;
    } 
    else if (pname === this.RENDERER) {
      result = profile.renderer;
    } 
    else if (pname === this.VERSION) {
      result = profile.version;
    } 
    else if (pname === this.SHADING_LANGUAGE_VERSION) {
      result = profile.shadingLanguage;
    }
    // Handle parameters from profile
    else {
      // Get parameter from profile first
      const paramSet = isWebGL2 ? {...profile.parameters, ...profile.webgl2Parameters} : profile.parameters;
      
      if (paramSet && pnameStr in paramSet) {
        const baseValue = paramSet[pnameStr];
        
        // Apply jitter based on value type
        if (Array.isArray(baseValue)) {
          result = applyJitterToArray(baseValue, pnameStr);
        } else {
          result = applyJitter(baseValue, pnameStr);
        }
      } 
      // Fall back to real value if not in profile
      else {
        result = originalGetParameter.call(this, pname);
      }
    }

    // Store in cache for consistent responses
    parameterCache.set(pnameStr, result);
    
    // Debug logging
    if (config.get('debug.logParameters')) {
      config.log(`getParameter(${pnameStr}) spoofed: ${JSON.stringify(result)}`);
    }
    
    return result;
  };

  /**
   * Shader precision format cache to ensure consistency
   */
  const shaderPrecisionCache = new Map();

  /**
   * Override getShaderPrecisionFormat method
   * @param {number} shaderType - The shader type
   * @param {number} precisionType - The precision type
   * @returns {WebGLShaderPrecisionFormat} The precision format
   */
  gl.getShaderPrecisionFormat = function(shaderType, precisionType) {
    // Create cache key
    const cacheKey = `${shaderType}-${precisionType}`;
    
    // Check cache first
    if (shaderPrecisionCache.has(cacheKey)) {
      return shaderPrecisionCache.get(cacheKey);
    }

    // Get the original precision format
    const originalFormat = originalGetShaderPrecisionFormat.call(this, shaderType, precisionType);
    
    // If we couldn't get the original format, return it as is
    if (!originalFormat) {
      return originalFormat;
    }
    
    // Create a new format with jittered values
    const jitteredFormat = {
      precision: applyJitter(originalFormat.precision, `${cacheKey}-precision`),
      rangeMin: originalFormat.rangeMin, // Keep min range intact
      rangeMax: applyJitter(originalFormat.rangeMax, `${cacheKey}-rangeMax`)
    };
    
    // WebGLShaderPrecisionFormat is not a plain object, so we need to wrap it
    const result = {
      precision: jitteredFormat.precision,
      rangeMin: jitteredFormat.rangeMin,
      rangeMax: jitteredFormat.rangeMax
    };
    
    // Store in cache
    shaderPrecisionCache.set(cacheKey, result);
    
    return result;
  };

  // Log successful installation
  config.log('Parameter spoofing installed');
  
  return true;
}

module.exports = {
  installParameterSpoofing
};