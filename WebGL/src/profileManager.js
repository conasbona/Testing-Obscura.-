// profileManager.js

const fs = require('fs').promises;
const path = require('path');

/**
 * Manages WebGL device profiles for fingerprint spoofing
 */
class ProfileManager {
  /**
   * Create a new ProfileManager
   * @param {Object} options Configuration options
   * @param {string} options.profilePath Path to the webgl.json file (default: './webgl.json')
   */
  constructor(options = {}) {
    this.profilePath = options.profilePath || path.join(__dirname, './webgl.json');
    this.profiles = null;
    this.gpuCapabilityMap = this._initCapabilityMap();
  }

  /**
   * Initialize GPU capability map with realistic parameter values
   * @private
   */
  _initCapabilityMap() {
    return {
      nvidia: {
        high: {
          pattern: /(RTX 30|RTX 40|RTX 20|GTX 16)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 32768,
            MAX_RENDERBUFFER_SIZE: 32768,
            MAX_VIEWPORT_DIMS: [32768, 32768],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 2047.5],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 16,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 16,
            MAX_COMBINED_UNIFORM_BLOCKS: 32,
          }
        },
        mid: {
          pattern: /(GTX 10|GTX 9)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 16384,
            MAX_RENDERBUFFER_SIZE: 16384,
            MAX_VIEWPORT_DIMS: [16384, 16384],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 1023.75],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 14,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 14,
            MAX_COMBINED_UNIFORM_BLOCKS: 28,
          }
        },
        low: {
          pattern: /(GT [1-9]|GTS|GTX [1-8])/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 8192,
            MAX_RENDERBUFFER_SIZE: 8192,
            MAX_VIEWPORT_DIMS: [8192, 8192],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 511.875],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 12,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
            MAX_COMBINED_UNIFORM_BLOCKS: 24,
          }
        }
      },
      amd: {
        high: {
          pattern: /(RX 6|RX 7|Radeon VII)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 16384,
            MAX_RENDERBUFFER_SIZE: 16384,
            MAX_VIEWPORT_DIMS: [16384, 16384],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 2047.5],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 15,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 15,
            MAX_COMBINED_UNIFORM_BLOCKS: 30,
          }
        },
        mid: {
          pattern: /(RX 5|RX 4|R9)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 16384,
            MAX_RENDERBUFFER_SIZE: 16384,
            MAX_VIEWPORT_DIMS: [16384, 16384],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 1023.75],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 14,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 14,
            MAX_COMBINED_UNIFORM_BLOCKS: 28,
          }
        },
        low: {
          pattern: /(HD|R[1-8])/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 8192,
            MAX_RENDERBUFFER_SIZE: 8192,
            MAX_VIEWPORT_DIMS: [8192, 8192],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 511.875],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 12,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
            MAX_COMBINED_UNIFORM_BLOCKS: 24,
          }
        }
      },
      intel: {
        high: {
          pattern: /(Iris Xe|UHD 6|Iris Plus)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 16384,
            MAX_RENDERBUFFER_SIZE: 16384,
            MAX_VIEWPORT_DIMS: [16384, 16384],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 255.875],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 12,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
            MAX_COMBINED_UNIFORM_BLOCKS: 24,
          }
        },
        mid: {
          pattern: /(Iris|UHD|HD 5|HD 6)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 8192,
            MAX_RENDERBUFFER_SIZE: 8192,
            MAX_VIEWPORT_DIMS: [8192, 8192],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 255.875],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: {
            MAX_ELEMENT_INDEX: 4294967294,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_VERTEX_UNIFORM_BLOCKS: 12,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
            MAX_COMBINED_UNIFORM_BLOCKS: 24,
          }
        },
        low: {
          pattern: /(HD 4|HD 3)/i,
          webgl1: {
            MAX_TEXTURE_SIZE: 8192,
            MAX_RENDERBUFFER_SIZE: 8192,
            MAX_VIEWPORT_DIMS: [8192, 8192],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 255.875],
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_TEXTURE_IMAGE_UNITS: 16,
          },
          webgl2: null // Older Intel GPUs often don't support WebGL2
        }
      }
    };
  }

  /**
   * Load profiles from the webgl.json file
   * @returns {Promise<Array>} The loaded profiles
   */
  async loadProfiles() {
    if (this.profiles) {
      return this.profiles;
    }

    try {
      const data = await fs.readFile(this.profilePath, 'utf8');
      this.profiles = JSON.parse(data);
      return this.profiles;
    } catch (error) {
      console.error('Failed to load WebGL profiles:', error);
      // Provide a minimal fallback set
      this.profiles = this._getFallbackProfiles();
      return this.profiles;
    }
  }

  /**
   * Get minimal fallback profiles in case the JSON file can't be loaded
   * @private
   * @returns {Array} Array of fallback profiles
   */
  _getFallbackProfiles() {
    return [
      {
        "Renderer": "WebKit WebGL",
        "ShadingLanguage": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",
        "ShadingLanguage2": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
        "UnmaskedRenderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "UnmaskedVendor": "Google Inc. (NVIDIA)",
        "Vendor": "WebKit",
        "Version": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
        "Version2": "WebGL 2.0 (OpenGL ES 3.0 Chromium)"
      },
      {
        "Renderer": "WebKit WebGL",
        "ShadingLanguage": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",
        "ShadingLanguage2": "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
        "UnmaskedRenderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
        "UnmaskedVendor": "Google Inc. (Intel)",
        "Vendor": "WebKit",
        "Version": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
        "Version2": "WebGL 2.0 (OpenGL ES 3.0 Chromium)"
      }
    ];
  }

  /**
   * Identify GPU vendor from the UnmaskedVendor string
   * @param {string} vendorString The UnmaskedVendor string
   * @returns {string} The identified vendor (nvidia, amd, intel) or 'generic'
   */
  _identifyVendor(vendorString) {
    if (!vendorString) return 'generic';
    
    if (vendorString.includes('NVIDIA')) return 'nvidia';
    if (vendorString.includes('AMD')) return 'amd';
    if (vendorString.includes('Intel')) return 'intel';
    
    return 'generic';
  }

  /**
   * Determine the GPU tier (high, mid, low) based on the renderer string
   * @param {string} vendor The GPU vendor (nvidia, amd, intel)
   * @param {string} rendererString The UnmaskedRenderer string
   * @returns {string} The GPU tier (high, mid, low)
   */
  _determineGpuTier(vendor, rendererString) {
    if (!rendererString || !vendor || !this.gpuCapabilityMap[vendor]) {
      return 'mid'; // Default to mid tier
    }

    // Check against patterns for each tier
    for (const [tier, data] of Object.entries(this.gpuCapabilityMap[vendor])) {
      if (data.pattern.test(rendererString)) {
        return tier;
      }
    }

    return 'mid'; // Default to mid tier
  }

  /**
   * Get capability parameters for a specific GPU
   * @param {string} vendor The GPU vendor (nvidia, amd, intel)
   * @param {string} tier The GPU tier (high, mid, low)
   * @param {boolean} isWebGL2 Whether the context is WebGL2
   * @returns {Object} WebGL capability parameters
   */
  _getCapabilities(vendor, tier, isWebGL2) {
    // Default fallback capabilities
    const defaultCaps = {
      MAX_TEXTURE_SIZE: 8192,
      MAX_RENDERBUFFER_SIZE: 8192,
      MAX_VIEWPORT_DIMS: [8192, 8192],
      ALIASED_LINE_WIDTH_RANGE: [1, 1],
      ALIASED_POINT_SIZE_RANGE: [1, 255.875],
      MAX_VERTEX_ATTRIBS: 16,
      MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
      MAX_VERTEX_UNIFORM_VECTORS: 4096,
      MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
      MAX_TEXTURE_IMAGE_UNITS: 16,
    };

    // WebGL2 specific default caps
    const defaultWebGL2Caps = isWebGL2 ? {
      MAX_ELEMENT_INDEX: 4294967294,
      MAX_UNIFORM_BLOCK_SIZE: 65536,
      MAX_VERTEX_UNIFORM_BLOCKS: 12,
      MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
      MAX_COMBINED_UNIFORM_BLOCKS: 24,
    } : {};

    // Try to get vendor and tier specific capabilities
    try {
      const vendorCaps = this.gpuCapabilityMap[vendor] || {};
      const tierCaps = vendorCaps[tier] || {};
      
      // Get WebGL1 capabilities
      const webgl1Caps = tierCaps.webgl1 || defaultCaps;
      
      // Get WebGL2 capabilities if applicable
      let webgl2Caps = {};
      if (isWebGL2) {
        // Only include WebGL2 caps if they exist for this vendor/tier
        if (tierCaps.webgl2 !== null) {
          webgl2Caps = tierCaps.webgl2 || defaultWebGL2Caps;
        } else {
          // This GPU doesn't support WebGL2
          return null;
        }
      }

      return {
        ...webgl1Caps,
        ...webgl2Caps
      };
    } catch (error) {
      console.error('Error getting capabilities:', error);
      return {
        ...defaultCaps,
        ...(isWebGL2 ? defaultWebGL2Caps : {})
      };
    }
  }

  /**
   * Get common WebGL extensions for a vendor
   * @param {string} vendor The GPU vendor
   * @returns {Array<string>} Array of common extensions
   */
  _getCommonExtensions(vendor) {
    // Extensions most GPUs support
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

    // Vendor-specific extensions
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

    return [
      ...commonExtensions,
      ...(vendorExtensions[vendor] || [])
    ];
  }

  /**
   * Get WebGL2-specific extensions based on vendor
   * @param {string} vendor The GPU vendor
   * @returns {Array<string>} Array of WebGL2 extensions
   */
  _getWebGL2Extensions(vendor) {
    const commonWebGL2Extensions = [
      "EXT_color_buffer_float",
      "EXT_disjoint_timer_query_webgl2",
      "EXT_texture_filter_anisotropic",
      "OES_draw_buffers_indexed",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_compressed_texture_s3tc_srgb",
      "WEBGL_debug_shaders",
      "WEBGL_lose_context"
    ];
    
    // Additional vendor-specific WebGL2 extensions
    const vendorWebGL2Extensions = {
      nvidia: [
        "WEBGL_compressed_texture_astc",
        "WEBGL_compressed_texture_etc",
        "WEBGL_compressed_texture_pvrtc"
      ],
      amd: [
        "WEBGL_compressed_texture_astc",
        "WEBGL_compressed_texture_etc"
      ],
      intel: []
    };
    
    return [
      ...commonWebGL2Extensions,
      ...(vendorWebGL2Extensions[vendor] || [])
    ];
  }

  /**
   * Select a random profile from the loaded profiles using PRNG
   * @param {Object} prng The PRNG instance
   * @returns {Promise<Object>} A normalized profile object
   */
  async selectProfile(prng) {
    const profiles = await this.loadProfiles();
    
    // Use the PRNG to select a random profile
    const randomIndex = Math.floor(prng.random() * profiles.length);
    const baseProfile = profiles[randomIndex];
    
    // Check if WebGL2 is supported in this profile
    const hasWebGL2 = !!baseProfile.Version2;
    
    // Identify vendor and GPU tier
    const vendor = this._identifyVendor(baseProfile.UnmaskedVendor);
    const tier = this._determineGpuTier(vendor, baseProfile.UnmaskedRenderer);
    
    // Get capabilities for WebGL1
    const capabilities = this._getCapabilities(vendor, tier, false);
    
    // Get WebGL2 capabilities if supported
    const webgl2Capabilities = hasWebGL2 ? 
      this._getCapabilities(vendor, tier, true) : null;
    
    // Get appropriate extensions
    const extensions = this._getCommonExtensions(vendor);
    const webgl2Extensions = hasWebGL2 ? this._getWebGL2Extensions(vendor) : [];
    
    // Normalize the profile format for our system
    return {
      // Identity information
      vendor: baseProfile.Vendor,
      renderer: baseProfile.Renderer,
      unmaskedVendor: baseProfile.UnmaskedVendor,
      unmaskedRenderer: baseProfile.UnmaskedRenderer,
      version: baseProfile.Version,
      version2: baseProfile.Version2 || null,
      shadingLanguage: baseProfile.ShadingLanguage,
      shadingLanguage2: baseProfile.ShadingLanguage2 || null,
      
      // GPU classification
      gpuVendor: vendor,
      gpuTier: tier,
      
      // Feature support flags
      supportsWebGL2: hasWebGL2,
      
      // Capability parameters
      parameters: capabilities,
      webgl2Parameters: webgl2Capabilities,
      
      // Extensions
      extensions: extensions,
      webgl2Extensions: webgl2Extensions
    };
  }
}

module.exports = ProfileManager;