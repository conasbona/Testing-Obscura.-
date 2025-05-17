// src/spoofing/extensionSpoof.js

/**
 * Extension spoofing module for WebGL fingerprinting protection
 * Intercepts and modifies getSupportedExtensions() and getExtension() calls
 */

/**
 * Install extension spoofing for a WebGL context
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context
 * @param {Object} profile - The selected GPU profile
 * @param {Object} prng - The PRNG instance
 * @param {Object} config - The configuration object
 * @returns {boolean} True if spoofing was installed
 */
function installExtensionSpoofing(gl, profile, prng, config) {
  if (!gl || !profile || !prng || !config) {
    return false;
  }

  // Check if extension spoofing is enabled
  if (!config.isEnabled('extensions')) {
    return false;
  }

  // Determine if this is a WebGL2 context
  const isWebGL2 = !!gl.createQuery;

  // Get blocked extensions from config
  const blockedExtensions = config.get('extensions.blockedExtensions', []);
  
  // Store original methods
  const originalGetSupportedExtensions = gl.getSupportedExtensions;
  const originalGetExtension = gl.getExtension;

  // Extension cache to ensure consistent responses
  const extensionCache = new Map();
  
  // Track which extensions have been excluded from the supported list
  const excludedExtensions = new Set();

  /**
   * Get a filtered list of extensions based on the profile and blocked list
   * @returns {string[]} Array of extension names
   */
  function getFilteredExtensions() {
    // Get the actual supported extensions
    const actualExtensions = originalGetSupportedExtensions.call(gl);
    
    // No extensions? Return empty array
    if (!actualExtensions || actualExtensions.length === 0) {
      return [];
    }
    
    // Get extensions from profile
    const profileExtensions = isWebGL2 
      ? [...profile.extensions, ...profile.webgl2Extensions]
      : profile.extensions;
    
    // Filter extensions
    const filteredExtensions = actualExtensions.filter(ext => {
      // Block explicitly blocked extensions
      if (blockedExtensions.includes(ext)) {
        excludedExtensions.add(ext);
        return false;
      }
      
      // If we have profile extensions, only include extensions in our profile
      if (profileExtensions && profileExtensions.length > 0) {
        const included = profileExtensions.includes(ext);
        if (!included) {
          excludedExtensions.add(ext);
        }
        return included;
      }
      
      // Default to allowing the extension
      return true;
    });
    
    return filteredExtensions;
  }

  /**
   * Override getSupportedExtensions method
   * @returns {string[]} Array of extension names
   */
  gl.getSupportedExtensions = function() {
    const filteredExtensions = getFilteredExtensions();
    
    // Debug logging
    if (config.get('debug.enabled')) {
      const actualExtensions = originalGetSupportedExtensions.call(gl);
      const blocked = actualExtensions.filter(ext => !filteredExtensions.includes(ext));
      
      if (blocked.length > 0) {
        config.log(`Blocked extensions: ${blocked.join(', ')}`, 'log');
      }
      
      config.log(`Supported extensions: ${filteredExtensions.length} (original: ${actualExtensions.length})`, 'log');
    }
    
    return filteredExtensions;
  };

  /**
 * Override getExtension method
 * @param {string} name - Extension name
 * @returns {Object|null} The extension object or null
 */
gl.getExtension = function(name) {
  // Check cache first for consistency
  if (extensionCache.has(name)) {
    return extensionCache.get(name);
  }
  
  // Block explicitly blocked extensions
  if (blockedExtensions.includes(name)) {
    // Debug logging
    if (config.get('debug.enabled')) {
      config.log(`Blocked extension: ${name}`, 'log');
    }
    
    // Cache and return null
    extensionCache.set(name, null);
    return null;
  }
  
  // If it was excluded from supported extensions, return null
  if (excludedExtensions.has(name)) {
    extensionCache.set(name, null);
    return null;
  }
  
  // Critical fingerprinting extensions should always be blocked
  // This is a safeguard in case they're not in blockedExtensions
  if (name === 'WEBGL_debug_renderer_info') {
    config.log('Critical fingerprinting extension blocked: WEBGL_debug_renderer_info', 'warn');
    extensionCache.set(name, null);
    return null;
  }
  
  // Otherwise get the real extension
  const result = originalGetExtension.call(gl, name);
  
  // Cache the result
  extensionCache.set(name, result);
  
  return result;
};

  // Log successful installation
  config.log('Extension spoofing installed');
  
  return true;
}

/**
 * Get WebGL extensions commonly supported by a specific vendor
 * @param {string} vendor - The GPU vendor ('nvidia', 'amd', 'intel')
 * @param {boolean} isWebGL2 - Whether this is for WebGL2
 * @returns {string[]} Array of extension names
 */
function getVendorExtensions(vendor, isWebGL2) {
  // Common extensions most GPUs support
  const commonExtensions = [
    "ANGLE_instanced_arrays",
    "EXT_blend_minmax",
    "EXT_color_buffer_half_float",
    "EXT_float_blend",
    "OES_element_index_uint",
    "OES_standard_derivatives",
    "OES_texture_float",
    "OES_texture_float_linear",
    "OES_texture_half_float",
    "OES_texture_half_float_linear",
    "OES_vertex_array_object",
    "WEBGL_color_buffer_float",
    "WEBGL_lose_context"
  ];

  // Vendor-specific extensions for WebGL1
  const vendorExtensions = {
    nvidia: [
      "EXT_texture_filter_anisotropic",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_compressed_texture_s3tc_srgb",
      "WEBGL_debug_shaders"
    ],
    amd: [
      "EXT_texture_filter_anisotropic",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_compressed_texture_s3tc_srgb",
      "WEBGL_debug_shaders"
    ],
    intel: [
      "EXT_texture_filter_anisotropic",
      "WEBGL_compressed_texture_s3tc"
    ],
    generic: []
  };

  // Additional extensions for WebGL2
  const webgl2Extensions = [
    "EXT_color_buffer_float",
    "EXT_texture_filter_anisotropic",
    "OES_draw_buffers_indexed",
    "WEBGL_compressed_texture_s3tc",
    "WEBGL_compressed_texture_s3tc_srgb",
    "WEBGL_debug_shaders"
  ];

  // Vendor-specific WebGL2 extensions
  const vendorWebGL2Extensions = {
    nvidia: [
      "WEBGL_compressed_texture_astc",
      "WEBGL_compressed_texture_etc"
    ],
    amd: [
      "WEBGL_compressed_texture_astc",
      "WEBGL_compressed_texture_etc"
    ],
    intel: [],
    generic: []
  };

  // Get the appropriate extension list
  const baseExtensions = [
    ...commonExtensions,
    ...(vendorExtensions[vendor] || vendorExtensions.generic)
  ];

  // Add WebGL2 extensions if applicable
  if (isWebGL2) {
    return [
      ...baseExtensions,
      ...webgl2Extensions,
      ...(vendorWebGL2Extensions[vendor] || vendorWebGL2Extensions.generic)
    ];
  }

  return baseExtensions;
}

module.exports = {
  installExtensionSpoofing,
  getVendorExtensions
};