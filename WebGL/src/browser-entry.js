// src/browser-entry.js

// Import required modules with browser-compatible alternatives
const SessionPRNG = require('./prng');
const Config = require('./config');

// Global state
let initialized = false;
let config = null;
let prng = null;
let activeProfile = null;
let originalGetContext = null;

// Mock ProfileManager that doesn't rely on fs
const ProfileManager = {
  // Sample GPU profiles that don't require loading from disk
  profiles: [
    {
      name: "nvidia_rtx_3080",
      vendor: "WebKit",
      renderer: "WebKit WebGL",
      unmaskedVendor: "Google Inc. (NVIDIA)",
      unmaskedRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      version: "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
      version2: "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
      shadingLanguage: "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
      shadingLanguage2: "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
      gpuVendor: "nvidia",
      gpuTier: "high",
      supportsWebGL2: true,
      parameters: {
        MAX_TEXTURE_SIZE: 32768,
        MAX_RENDERBUFFER_SIZE: 32768,
        MAX_VIEWPORT_DIMS: [32768, 32768],
        ALIASED_LINE_WIDTH_RANGE: [1, 1],
        ALIASED_POINT_SIZE_RANGE: [1, 1024],
        MAX_VERTEX_ATTRIBS: 16,
        MAX_VERTEX_UNIFORM_VECTORS: 4096,
        MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
        MAX_VARYING_VECTORS: 30,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
        MAX_TEXTURE_IMAGE_UNITS: 16,
        RED_BITS: 8,
        GREEN_BITS: 8,
        BLUE_BITS: 8,
        ALPHA_BITS: 8,
        DEPTH_BITS: 24,
        STENCIL_BITS: 0
      },
      webgl2Parameters: {
        MAX_ELEMENT_INDEX: 4294967294,
        MAX_UNIFORM_BLOCK_SIZE: 65536,
        MAX_VERTEX_UNIFORM_BLOCKS: 16,
        MAX_FRAGMENT_UNIFORM_BLOCKS: 16,
        MAX_COMBINED_UNIFORM_BLOCKS: 32,
        MAX_DRAW_BUFFERS: 8,
        MAX_COLOR_ATTACHMENTS: 8,
        MAX_SAMPLES: 16
      },
      // More realistic extension list with commonly available extensions
      extensions: [
        "ANGLE_instanced_arrays",
        "EXT_blend_minmax",
        "EXT_color_buffer_half_float",
        "EXT_float_blend",
        "EXT_texture_filter_anisotropic",
        "OES_element_index_uint",
        "OES_standard_derivatives",
        "OES_texture_float",
        "OES_texture_float_linear",
        "OES_texture_half_float",
        "OES_texture_half_float_linear",
        "OES_vertex_array_object",
        "WEBGL_color_buffer_float",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_lose_context"
      ],
      webgl2Extensions: [
        "EXT_color_buffer_float",
        "EXT_texture_filter_anisotropic",
        "OES_draw_buffers_indexed",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_compressed_texture_s3tc_srgb",
        "WEBGL_debug_shaders",
        "EXT_texture_norm16",
        "EXT_texture_compression_bptc",
        "KHR_parallel_shader_compile"
      ]
    },
    {
      name: "amd_radeon_rx_6800",
      vendor: "WebKit",
      renderer: "WebKit WebGL",
      unmaskedVendor: "Google Inc. (AMD)",
      unmaskedRenderer: "ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)",
      version: "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
      version2: "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
      shadingLanguage: "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
      shadingLanguage2: "WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)",
      gpuVendor: "amd",
      gpuTier: "high",
      supportsWebGL2: true,
      parameters: {
        MAX_TEXTURE_SIZE: 16384,
        MAX_RENDERBUFFER_SIZE: 16384,
        MAX_VIEWPORT_DIMS: [16384, 16384],
        ALIASED_LINE_WIDTH_RANGE: [1, 1],
        ALIASED_POINT_SIZE_RANGE: [1, 1024],
        MAX_VERTEX_ATTRIBS: 16,
        MAX_VERTEX_UNIFORM_VECTORS: 4096,
        MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
        MAX_VARYING_VECTORS: 30,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
        MAX_TEXTURE_IMAGE_UNITS: 16,
        RED_BITS: 8,
        GREEN_BITS: 8,
        BLUE_BITS: 8,
        ALPHA_BITS: 8,
        DEPTH_BITS: 24,
        STENCIL_BITS: 0
      },
      webgl2Parameters: {
        MAX_ELEMENT_INDEX: 4294967294,
        MAX_UNIFORM_BLOCK_SIZE: 65536,
        MAX_VERTEX_UNIFORM_BLOCKS: 16,
        MAX_FRAGMENT_UNIFORM_BLOCKS: 16,
        MAX_COMBINED_UNIFORM_BLOCKS: 32,
        MAX_DRAW_BUFFERS: 8,
        MAX_COLOR_ATTACHMENTS: 8,
        MAX_SAMPLES: 16
      },
      extensions: [
        "ANGLE_instanced_arrays",
        "EXT_blend_minmax",
        "EXT_color_buffer_half_float",
        "EXT_float_blend",
        "EXT_texture_filter_anisotropic",
        "OES_element_index_uint",
        "OES_standard_derivatives",
        "OES_texture_float",
        "OES_texture_float_linear",
        "OES_texture_half_float",
        "OES_texture_half_float_linear",
        "OES_vertex_array_object",
        "WEBGL_color_buffer_float",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_lose_context"
      ],
      webgl2Extensions: [
        "EXT_color_buffer_float",
        "EXT_texture_filter_anisotropic",
        "OES_draw_buffers_indexed",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_compressed_texture_s3tc_srgb",
        "WEBGL_debug_shaders",
        "EXT_texture_norm16",
        "EXT_texture_compression_rgtc",
        "KHR_parallel_shader_compile"
      ]
    }
  ],

  // Simplified selectProfile method
  selectProfile: function(prng) {
    // Select a random profile
    const profileIndex = Math.floor(prng.random() * this.profiles.length);
    return this.profiles[profileIndex];
  }
};

// Import spoofing modules
const { installParameterSpoofing } = require('./spoofing/parameterSpoof');
const { installExtensionSpoofing } = require('./spoofing/extensionSpoof');
const { installDrawSpoofing } = require('./spoofing/drawSpoof');
const { installReadbackSpoofing } = require('./spoofing/readbackSpoof');

/**
 * Initialize the WebGL fingerprinting protection
 * @param {Object} userConfig - User-provided configuration options
 * @returns {Promise<Object>} Configuration and API methods
 */
async function initialize(userConfig = {}) {
  if (initialized) {
    return { config, prng };
  }

  try {
    // Log initialization start
    console.log('[WebGL Protection] Initializing...');

    // Create configuration with user options
    config = new Config(userConfig);

    // Initialize PRNG with optional seed
    const seed = config.get('seed');
    prng = new SessionPRNG(seed);

    // Select a random profile
    const preferredVendor = config.get('profile.preferredVendor');
    const preferredTier = config.get('profile.preferredTier');
    activeProfile = ProfileManager.selectProfile(prng);
    
    // Log profile selection
    console.log(`[WebGL Protection] Selected profile: ${activeProfile.gpuVendor} ${activeProfile.gpuTier} (${activeProfile.unmaskedRenderer})`);

    // Hook canvas getContext to intercept WebGL context creation
    installContextHook();

    // Mark as initialized
    initialized = true;
    console.log('[WebGL Protection] Successfully initialized');

    return { config, prng };
  } catch (error) {
    console.error('[WebGL Protection] Initialization error:', error);
    return { error: 'Failed to initialize WebGL fingerprinting protection' };
  }
}

/**
 * Install hook for canvas.getContext to intercept WebGL context creation
 */
function installContextHook() {
  // Store original method
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  
  console.log('[WebGL Protection] Installing context hook');

  // Replace with our version
  HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
    // Get original context
    const context = originalGetContext.call(this, contextType, ...args);

    // Skip if context creation failed or protection is disabled
    if (!context || !config.get('enabled')) {
      return context;
    }

    // Apply WebGL spoofing if this is a WebGL context
    if (contextType === 'webgl' || contextType === 'experimental-webgl' || contextType === 'webgl2') {
      console.log(`[WebGL Protection] Intercepted context creation: ${contextType}`);
      
      // Create shared state object for cross-module communication
      const state = {
        noiseApplied: false
      };

      // Apply spoofing modules
      applyWebGLSpoofing(context, contextType, state);

      // Visual indicator for debugging
      if (config.get('debug.visualIndicator')) {
        this.style.outline = '2px solid rgba(0, 128, 255, 0.5)';
        this.setAttribute('data-webgl-protected', 'true');
      }
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
// In browser-entry.js - Update the applyWebGLSpoofing function

function applyWebGLSpoofing(gl, contextType, state) {
  // Determine if this is a WebGL2 context
  const isWebGL2 = contextType === 'webgl2';
  
  // Skip WebGL2 if profile doesn't support it
  if (isWebGL2 && !activeProfile.supportsWebGL2) {
    console.log('[WebGL Protection] Skipping WebGL2 spoofing (profile does not support WebGL2)');
    return;
  }

  // Detect testing sites for special handling
  const isTestSite = typeof window !== 'undefined' && (
    window.location.hostname.includes('browserleaks.com') ||
    window.location.hostname.includes('amiunique.org') ||
    window.location.hostname.includes('fingerprintjs.github.io')
  );
  
  if (isTestSite) {
    console.log('[WebGL Protection] Fingerprinting test site detected - applying targeted protection');
  }

  // 1. Block critical fingerprinting extensions
  const originalGetExtension = gl.getExtension;
  gl.getExtension = function(name) {
    if (name === 'WEBGL_debug_renderer_info') {
      console.log('[WebGL Protection] Blocking WEBGL_debug_renderer_info extension');
      return null;
    }
    return originalGetExtension.call(this, name);
  };
  
  // 2. Spoof vendor and renderer
  const originalGetParameter = gl.getParameter;
  gl.getParameter = function(pname) {
    // Constants for WEBGL_debug_renderer_info extension
    const UNMASKED_VENDOR_WEBGL = 0x9245;
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    
    if (pname === UNMASKED_VENDOR_WEBGL) {
      console.log('[WebGL Protection] Spoofing unmasked vendor');
      return activeProfile.unmaskedVendor;
    } 
    else if (pname === UNMASKED_RENDERER_WEBGL) {
      console.log('[WebGL Protection] Spoofing unmasked renderer');
      return activeProfile.unmaskedRenderer;
    }
    else if (pname === gl.VENDOR) {
      return activeProfile.vendor;
    } 
    else if (pname === gl.RENDERER) {
      return activeProfile.renderer;
    }
    
    // Other parameters pass through
    return originalGetParameter.call(this, pname);
  };
  
  // 3. Critical fix: Add direct pixel spoofing for readPixels and canvas methods
  // This ensures image fingerprinting is affected
  
  // Hook readPixels
  const originalReadPixels = gl.readPixels;
  gl.readPixels = function(x, y, width, height, format, type, pixels) {
    // Call original first
    originalReadPixels.call(this, x, y, width, height, format, type, pixels);
    
    // Apply noise to the pixel data
    if (pixels && pixels.length) {
      console.log('[WebGL Protection] Adding noise to readPixels output');
      
      // Create a simple noise function using the PRNG
      const pixelNoise = function(index) {
        // Create a deterministic but unique value for this pixel
        const seed = `${x},${y},${width},${height},${index}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = ((hash << 5) - hash) + seed.charCodeAt(i);
          hash = hash & hash; // Convert to 32bit integer
        }
        
        // Generate noise in range [-3, 3]
        return (hash % 7) - 3;
      };
      
      // Modify pixel data
      const components = format === gl.RGB ? 3 : 4;
      for (let i = 0; i < pixels.length; i += components) {
        // Only modify RGB, not alpha
        for (let j = 0; j < (components > 3 ? 3 : components); j++) {
          // Add consistent noise
          const noise = pixelNoise(i + j);
          pixels[i + j] = Math.max(0, Math.min(255, pixels[i + j] + noise));
        }
      }
    }
  };
  
  // 4. Protect canvas.toDataURL and toBlob
  if (gl.canvas) {
    const canvas = gl.canvas;
    const originalToDataURL = canvas.toDataURL;
    
    canvas.toDataURL = function(...args) {
      console.log('[WebGL Protection] Intercepting toDataURL');
      
      // Get the original data URL
      const dataURL = originalToDataURL.apply(this, args);
      
      // For WebGL canvases, apply noise directly to pixels
      if (this === gl.canvas) {
        // Create a temporary canvas to modify the data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        
        // Draw the content to the temp canvas
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this, 0, 0);
        
        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Apply noise to RGB channels
        for (let i = 0; i < pixels.length; i += 4) {
          // Simple deterministic noise function
          const x = Math.floor((i / 4) % tempCanvas.width);
          const y = Math.floor((i / 4) / tempCanvas.width);
          const seed = `${x},${y},${gl.canvas.id}`;
          let hash = 0;
          for (let j = 0; j < seed.length; j++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(j);
            hash = hash & hash;
          }
          
          // Different noise for each channel
          pixels[i] = Math.max(0, Math.min(255, pixels[i] + ((hash % 7) - 3)));       // R
          pixels[i+1] = Math.max(0, Math.min(255, pixels[i+1] + (((hash >> 3) % 7) - 3))); // G
          pixels[i+2] = Math.max(0, Math.min(255, pixels[i+2] + (((hash >> 6) % 7) - 3))); // B
          // Leave alpha unchanged
        }
        
        // Put the modified image data back
        tempCtx.putImageData(imageData, 0, 0);
        
        // Return the modified data URL
        return tempCanvas.toDataURL(...args);
      }
      
      return dataURL;
    };
    
    // Similar implementation for toBlob if needed
    if (canvas.toBlob) {
      const originalToBlob = canvas.toBlob;
      canvas.toBlob = function(callback, ...args) {
        console.log('[WebGL Protection] Intercepting toBlob');
        
        if (this === gl.canvas) {
          // Create a temporary canvas to modify the data
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = this.width;
          tempCanvas.height = this.height;
          
          // Draw the content to the temp canvas
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(this, 0, 0);
          
          // Get image data
          const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const pixels = imageData.data;
          
          // Apply noise to RGB channels (same as toDataURL)
          for (let i = 0; i < pixels.length; i += 4) {
            const x = Math.floor((i / 4) % tempCanvas.width);
            const y = Math.floor((i / 4) / tempCanvas.width);
            const seed = `${x},${y},${gl.canvas.id}`;
            let hash = 0;
            for (let j = 0; j < seed.length; j++) {
              hash = ((hash << 5) - hash) + seed.charCodeAt(j);
              hash = hash & hash;
            }
            
            pixels[i] = Math.max(0, Math.min(255, pixels[i] + ((hash % 7) - 3)));
            pixels[i+1] = Math.max(0, Math.min(255, pixels[i+1] + (((hash >> 3) % 7) - 3)));
            pixels[i+2] = Math.max(0, Math.min(255, pixels[i+2] + (((hash >> 6) % 7) - 3)));
          }
          
          // Put the modified image data back
          tempCtx.putImageData(imageData, 0, 0);
          
          // Call toBlob on the modified canvas
          return originalToBlob.call(tempCanvas, callback, ...args);
        }
        
        return originalToBlob.call(this, callback, ...args);
      };
    }
  }
  
  console.log('[WebGL Protection] Core protection applied');
  
  // 5. Apply any other necessary protections based on config
  if (config.config.drawCalls && config.config.drawCalls.enabled) {
    // Install draw call spoofing as a backup, but direct pixel modification
    // is our primary approach now
    installDrawSpoofing(gl, activeProfile, prng, config, state);
  }
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
    if (originalGetContext) {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
    
    // Mark as uninitialized
    initialized = false;
    
    return true;
  } catch (error) {
    console.error('[WebGL Protection] Error disabling protection:', error);
    return false;
  }
}

/**
 * Get current status of the WebGL fingerprinting protection
 */
function getStatus() {
  return {
    initialized,
    enabled: initialized && config && config.get('enabled'),
    profile: activeProfile ? {
      vendor: activeProfile.gpuVendor,
      tier: activeProfile.gpuTier,
      webgl2Support: activeProfile.supportsWebGL2
    } : null
  };
}

// Export for browser environment
if (typeof window !== 'undefined') {
  // Add auto-initialization
  window.enableWebGLProtection = async function(userConfig = {}) {
    console.log('[WebGL Protection] Browser activation started');
    return await initialize(userConfig || window._webglProtectionConfig || {});
  };

  // Auto-initialize if config is present
  if (window._webglProtectionConfig) {
    console.log('[WebGL Protection] Auto-initializing from config');
    setTimeout(() => {
      window.enableWebGLProtection(window._webglProtectionConfig)
        .then(result => {
          console.log('[WebGL Protection] Auto-initialization complete', result);
        })
        .catch(error => {
          console.error('[WebGL Protection] Auto-initialization failed:', error);
        });
    }, 0);
  }
}

// Add diagnostic function to window object
if (typeof window !== 'undefined') {
  window.diagnoseWebGL = function() {
    console.log("=== WebGL Diagnostics ===");
    
    try {
      // Test basic context creation
      const canvas = document.createElement('canvas');
      console.log("Canvas created");
      
      // Try to get WebGL1 context
      const gl1 = canvas.getContext('webgl');
      console.log("WebGL1 context creation result:", !!gl1);
      
      if (gl1) {
        // Check basic parameters
        console.log("Vendor:", gl1.getParameter(gl1.VENDOR));
        console.log("Renderer:", gl1.getParameter(gl1.RENDERER));
        
        // Try to get extensions
        const extensions = gl1.getSupportedExtensions();
        console.log("Extensions count:", extensions ? extensions.length : 0);
        console.log("Extensions:", extensions);
        
        // Try a simple render test
        gl1.clearColor(1.0, 0.0, 0.0, 1.0);
        gl1.clear(gl1.COLOR_BUFFER_BIT);
        console.log("Basic render test complete");
        
        // Try readback
        const pixels = new Uint8Array(4);
        gl1.readPixels(0, 0, 1, 1, gl1.RGBA, gl1.UNSIGNED_BYTE, pixels);
        console.log("Readback result:", Array.from(pixels));
      }
      
      // Try WebGL2
      const gl2 = canvas.getContext('webgl2');
      console.log("WebGL2 context creation result:", !!gl2);
      
      return {
        webgl1: !!gl1,
        webgl2: !!gl2,
        diagnosticsRun: true
      };
    } catch (e) {
      console.error("WebGL Diagnostics error:", e);
      return {
        error: e.message,
        diagnosticsRun: true
      };
    }
  };
  
  // Auto-run diagnostics after initialization
  setTimeout(() => {
    if (window.diagnoseWebGL) {
      console.log("Running automatic WebGL diagnostics...");
      window.diagnoseWebGL();
    }
  }, 2000);
}

// Export API
module.exports = {
  initialize,
  disable,
  getStatus
};