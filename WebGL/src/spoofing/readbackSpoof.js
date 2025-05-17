// src/spoofing/readbackSpoof.js

/**
 * Readback spoofing module for WebGL fingerprinting protection
 * Intercepts and modifies readPixels, toDataURL, and toBlob to ensure
 * fingerprinting reads receive modified data
 */

/**
 * Install readback spoofing for a WebGL context
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context
 * @param {Object} profile - The selected GPU profile
 * @param {Object} prng - The PRNG instance
 * @param {Object} config - The configuration object
 * @param {Object} state - Shared state object for cross-module communication
 * @returns {boolean} True if spoofing was installed
 */
function installReadbackSpoofing(gl, profile, prng, config, state) {
  if (!gl || !profile || !prng || !config || !state) {
    return false;
  }

  // Check if readback protection is enabled
  if (!config.isEnabled('readback')) {
    return false;
  }

  // Get configuration values
  const pixelJitter = config.get('readback.pixelJitter', 3);
  const includeAlpha = config.get('readback.includeAlpha', false);
  
  // Store original methods
  const originalReadPixels = gl.readPixels;
  
  // Get canvas element
  const canvas = gl.canvas;
  if (!canvas) {
    config.log('No canvas found for WebGL context', 'warn');
    return false;
  }
  
  // Store original canvas methods
  const originalToDataURL = canvas.toDataURL;
  const originalToBlob = canvas.toBlob;
  
  // Create a PRNG specifically for pixel noise
  const pixelPrng = prng.deriveGenerator('readback-noise');

  /**
   * Apply consistent noise to pixel data
   * @param {ArrayBufferView} pixels - The pixel data
   * @param {number} width - The width of the image
   * @param {number} height - The height of the image
   * @param {number} format - The pixel format (gl.RGBA, gl.RGB, etc.)
   */
  function applyPixelNoise(pixels, width, height, format) {
    // Skip if not a typed array
    if (!ArrayBuffer.isView(pixels)) {
      return;
    }
    
    // Determine components per pixel based on format
    let componentsPerPixel = 4; // default for RGBA
    if (format === gl.RGB) {
      componentsPerPixel = 3;
    } else if (format === gl.ALPHA || format === gl.LUMINANCE) {
      componentsPerPixel = 1;
    } else if (format === gl.LUMINANCE_ALPHA) {
      componentsPerPixel = 2;
    }
    
    // Apply consistent noise to each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate base index in the pixel array
        const baseIndex = (y * width + x) * componentsPerPixel;
        
        // Get a consistent noise value for this pixel
        const pixelSeed = `${x},${y}-${pixelPrng.getSeed()}`;
        const pixelNoisePrng = prng.deriveGenerator(pixelSeed);
        
        // Apply noise to each component
        for (let c = 0; c < componentsPerPixel; c++) {
          // Skip alpha channel if configured to do so
          if (c === 3 && !includeAlpha) {
            continue;
          }
          
          // Get consistent noise value for this component
          const componentNoise = Math.floor(pixelNoisePrng.random() * (pixelJitter * 2 + 1)) - pixelJitter;
          
          // Bounds check
          if (baseIndex + c < pixels.length) {
            // Apply noise differently based on array type
            if (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) {
              // 8-bit per channel (0-255)
              pixels[baseIndex + c] = Math.max(0, Math.min(255, pixels[baseIndex + c] + componentNoise));
            } else if (pixels instanceof Float32Array) {
              // Float values (0.0-1.0)
              pixels[baseIndex + c] = Math.max(0, Math.min(1, pixels[baseIndex + c] + (componentNoise / 255)));
            } else {
              // Other types (Uint16Array, etc.)
              // Adjust noise based on maximum value for the type
              const maxValue = Math.pow(2, (pixels.BYTES_PER_ELEMENT * 8)) - 1;
              const typeNoise = Math.floor(componentNoise * (maxValue / 255));
              pixels[baseIndex + c] = Math.max(0, Math.min(maxValue, pixels[baseIndex + c] + typeNoise));
            }
          }
        }
      }
    }
  }

  /**
   * Override readPixels method
   */
  gl.readPixels = function(x, y, width, height, format, type, pixels) {
    // Call original method first
    originalReadPixels.call(this, x, y, width, height, format, type, pixels);
    
    // Skip modification if draw call spoofing has already been applied
    if (state.noiseApplied) {
      config.log('Skipping readPixels noise (already applied by draw spoofing)');
      return;
    }
    
    // Apply noise to the pixel data
    applyPixelNoise(pixels, width, height, format);
    
    // Debug logging
    config.log(`Applied noise to readPixels (${width}x${height})`);
  };

  /**
   * Apply noise to image data
   * @param {ImageData} imageData - The image data to modify
   */
  function applyImageDataNoise(imageData) {
    if (!imageData || !imageData.data) {
      return;
    }
    
    // Apply noise to the image data
    applyPixelNoise(imageData.data, imageData.width, imageData.height, gl.RGBA);
  }

  /**
   * Override toDataURL method
   */
  canvas.toDataURL = function(...args) {
    // Skip modification if draw call spoofing has already been applied
    if (state.noiseApplied) {
      return originalToDataURL.apply(this, args);
    }
    
    // Create a temporary canvas to modify the data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    
    // Copy content to temp canvas
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this, 0, 0);
    
    // Get image data and apply noise
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    applyImageDataNoise(imageData);
    
    // Put modified data back
    tempCtx.putImageData(imageData, 0, 0);
    
    // Generate data URL from modified canvas
    return originalToDataURL.apply(tempCanvas, args);
  };

  /**
   * Override toBlob method if available
   */
  if (originalToBlob) {
    canvas.toBlob = function(callback, ...args) {
      // Skip modification if draw call spoofing has already been applied
      if (state.noiseApplied) {
        return originalToBlob.apply(this, [callback, ...args]);
      }
      
      // Create a temporary canvas to modify the data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      
      // Copy content to temp canvas
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this, 0, 0);
      
      // Get image data and apply noise
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      applyImageDataNoise(imageData);
      
      // Put modified data back
      tempCtx.putImageData(imageData, 0, 0);
      
      // Generate blob from modified canvas
      return originalToBlob.apply(tempCanvas, [callback, ...args]);
    };
  }

  // Log successful installation
  config.log('Readback spoofing installed');
  
  return true;
}

/**
 * Helper function to apply noise to a data URL (for iframe fingerprinting protection)
 * @param {string} dataURL - The data URL to modify
 * @param {Object} prng - The PRNG instance
 * @param {Object} config - The configuration object
 * @returns {Promise<string>} The modified data URL
 */
async function applyNoiseToDataURL(dataURL, prng, config) {
  // Skip if not a data URL or not a PNG image
  if (!dataURL || !dataURL.startsWith('data:image/png')) {
    return dataURL;
  }
  
  // Create an image from the data URL
  const img = new Image();
  
  // Wait for the image to load using a promise
  const imageLoaded = new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image from data URL'));
    img.src = dataURL;
  });
  
  try {
    // Wait for the image to load
    await imageLoaded;
    
    // Create a canvas to draw the image
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300;
    canvas.height = img.height || 150;
    
    // Draw the image to the canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Get configuration values
    const pixelJitter = config.get('readback.pixelJitter', 3);
    const includeAlpha = config.get('readback.includeAlpha', false);
    
    // Create a PRNG specifically for pixel noise
    const pixelPrng = prng.deriveGenerator('dataurl-noise');
    
    // Apply noise to each pixel
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        // Calculate base index in the pixel array
        const baseIndex = (y * imageData.width + x) * 4;
        
        // Get a consistent noise value for this pixel
        const pixelSeed = `${x},${y}-${pixelPrng.getSeed()}`;
        const pixelNoisePrng = prng.deriveGenerator(pixelSeed);
        
        // Apply noise to RGB channels
        for (let c = 0; c < 3; c++) {
          const componentNoise = Math.floor(pixelNoisePrng.random() * (pixelJitter * 2 + 1)) - pixelJitter;
          imageData.data[baseIndex + c] = Math.max(0, Math.min(255, imageData.data[baseIndex + c] + componentNoise));
        }
        
        // Apply noise to alpha channel if configured
        if (includeAlpha) {
          const alphaNoise = Math.floor(pixelNoisePrng.random() * (pixelJitter + 1)) - Math.floor(pixelJitter / 2);
          imageData.data[baseIndex + 3] = Math.max(0, Math.min(255, imageData.data[baseIndex + 3] + alphaNoise));
        }
      }
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
    
    // Return the modified data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error applying noise to data URL:', error);
    return dataURL; // Return original if there was an error
  }
}

module.exports = {
  installReadbackSpoofing,
  applyNoiseToDataURL
};