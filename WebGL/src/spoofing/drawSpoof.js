// src/spoofing/drawSpoof.js

/**
 * Draw call spoofing module for WebGL fingerprinting protection
 * Injects shader-based noise to modify rendered output
 */

/**
 * Install draw call spoofing for a WebGL context
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context
 * @param {Object} profile - The selected GPU profile
 * @param {Object} prng - The PRNG instance
 * @param {Object} config - The configuration object
 * @param {Object} state - Shared state object for cross-module communication
 * @returns {boolean} True if spoofing was installed
 */
function installDrawSpoofing(gl, profile, prng, config, state) {
  if (!gl || !profile || !prng || !config || !state) {
    return false;
  }

  // Check if draw call spoofing is enabled
  if (!config.isEnabled('drawCalls')) {
    return false;
  }

  // Store original draw methods
  const originalDrawArrays = gl.drawArrays;
  const originalDrawElements = gl.drawElements;
  const originalDrawArraysInstanced = gl.drawArraysInstanced || gl.drawArraysInstancedANGLE;
  const originalDrawElementsInstanced = gl.drawElementsInstanced || gl.drawElementsInstancedANGLE;

  // Track whether we've applied noise to this context
  let noiseApplied = false;

  // Get configuration values
  const noiseAmount = config.get('drawCalls.noiseAmount', 0.02);
  const noiseGranularity = config.get('drawCalls.noiseGranularity', 64);

  // Create PRNG specifically for noise shader
  const noisePrng = prng.deriveGenerator('draw-noise');

  /**
   * Vertex shader source for noise overlay
   */
  const noiseVertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  /**
   * Fragment shader source for noise overlay
   */
  const noiseFragmentShaderSource = `
    precision mediump float;
    
    uniform float u_noiseAmount;
    uniform float u_seed;
    uniform vec2 u_noiseScale;
    varying vec2 v_texCoord;
    
    // Pseudo-random function
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) * u_seed) * 43758.5453);
    }
    
    void main() {
      // Create grid-based noise
      vec2 noiseCoord = floor(v_texCoord * u_noiseScale) / u_noiseScale;
      float noise = rand(noiseCoord) * u_noiseAmount;
      
      // Subtle RGB noise adjustment
      vec3 noiseColor = vec3(
        rand(noiseCoord + vec2(0.1, 0.0)) * u_noiseAmount,
        rand(noiseCoord + vec2(0.0, 0.1)) * u_noiseAmount,
        rand(noiseCoord + vec2(0.1, 0.1)) * u_noiseAmount
      );
      
      // Apply noise to fragment color
      gl_FragColor = vec4(noiseColor - (u_noiseAmount * 0.5), 0.0);
    }
  `;

  /**
   * Create and compile a shader
   * @param {number} type - The shader type
   * @param {string} source - The shader source code
   * @returns {WebGLShader} The compiled shader
   */
  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      config.log(`Shader compilation failed: ${error}`, 'error');
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  /**
   * Create the noise shader program
   * @returns {Object} The shader program and attributes/uniforms
   */
  function createNoiseProgram() {
    // Create and compile shaders
    const vertexShader = createShader(gl.VERTEX_SHADER, noiseVertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, noiseFragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      return null;
    }
    
    // Create and link program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      config.log(`Program linking failed: ${error}`, 'error');
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    
    // Get attribute and uniform locations
    const positionAttribute = gl.getAttribLocation(program, 'a_position');
    const noiseAmountUniform = gl.getUniformLocation(program, 'u_noiseAmount');
    const seedUniform = gl.getUniformLocation(program, 'u_seed');
    const noiseScaleUniform = gl.getUniformLocation(program, 'u_noiseScale');
    
    return {
      program,
      attributes: {
        position: positionAttribute
      },
      uniforms: {
        noiseAmount: noiseAmountUniform,
        seed: seedUniform,
        noiseScale: noiseScaleUniform
      },
      vertexShader,
      fragmentShader
    };
  }

  /**
   * Apply noise to the current framebuffer
   */
  function applyNoise() {
    // Skip if we've already applied noise
    if (noiseApplied) {
      return;
    }
    
    // Save current WebGL state
    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const currentBlend = gl.getParameter(gl.BLEND);
    const currentBlendSrcRGB = gl.getParameter(gl.BLEND_SRC_RGB);
    const currentBlendDstRGB = gl.getParameter(gl.BLEND_DST_RGB);
    const currentViewport = gl.getParameter(gl.VIEWPORT);
    const currentArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const currentActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    const currentAttribState = [];
    
    // Create noise program if we haven't already
    const noiseProgram = createNoiseProgram();
    if (!noiseProgram) {
      config.log('Failed to create noise program', 'error');
      return;
    }
    
    // Save attribute states
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    for (let i = 0; i < maxVertexAttribs; i++) {
      currentAttribState[i] = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
    }
    
    try {
      // Set up additive blending
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      
      // Use noise program
      gl.useProgram(noiseProgram.program);
      
      // Set uniforms
      gl.uniform1f(noiseProgram.uniforms.noiseAmount, noiseAmount);
      gl.uniform1f(noiseProgram.uniforms.seed, noisePrng.random() * 100);
      gl.uniform2f(noiseProgram.uniforms.noiseScale, noiseGranularity, noiseGranularity);
      
      // Create quad vertices
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
      ]), gl.STATIC_DRAW);
      
      // Set up attribute
      gl.enableVertexAttribArray(noiseProgram.attributes.position);
      gl.vertexAttribPointer(noiseProgram.attributes.position, 2, gl.FLOAT, false, 0, 0);
      
      // Draw fullscreen quad
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      // Clean up
      gl.disableVertexAttribArray(noiseProgram.attributes.position);
      gl.deleteBuffer(buffer);
      
      // Mark as applied
      noiseApplied = true;
      state.noiseApplied = true;
      
      // Debug logging
      config.log('Applied noise to WebGL context');
    } catch (error) {
      config.log(`Error applying noise: ${error.message}`, 'error');
    } finally {
      // Restore previous state
      gl.useProgram(currentProgram);
      
      if (!currentBlend) {
        gl.disable(gl.BLEND);
      } else {
        gl.blendFunc(currentBlendSrcRGB, currentBlendDstRGB);
      }
      
      gl.bindBuffer(gl.ARRAY_BUFFER, currentArrayBuffer);
      gl.activeTexture(currentActiveTexture);
      
      // Restore attribute states
      for (let i = 0; i < maxVertexAttribs; i++) {
        if (currentAttribState[i]) {
          gl.enableVertexAttribArray(i);
        } else {
          gl.disableVertexAttribArray(i);
        }
      }
    }
  }

  /**
   * Determine if a draw call is significant enough to apply noise
   * @param {number} count - The number of vertices/elements to draw
   * @returns {boolean} True if significant
   */
  function isSignificantDrawCall(count) {
    // Consider draws with more than 10 vertices significant
    return count > 10;
  }

  /**
   * Override drawArrays method
   */
  gl.drawArrays = function(mode, first, count) {
    // Apply noise if this is a significant draw
    if (isSignificantDrawCall(count)) {
      applyNoise();
    }
    
    // Call original method
    return originalDrawArrays.call(this, mode, first, count);
  };

  /**
   * Override drawElements method
   */
  gl.drawElements = function(mode, count, type, offset) {
    // Apply noise if this is a significant draw
    if (isSignificantDrawCall(count)) {
      applyNoise();
    }
    
    // Call original method
    return originalDrawElements.call(this, mode, count, type, offset);
  };

  // Handle instanced draw calls if available
  if (originalDrawArraysInstanced) {
    gl.drawArraysInstanced = function(mode, first, count, instanceCount) {
      // Apply noise if this is a significant draw
      if (isSignificantDrawCall(count * instanceCount)) {
        applyNoise();
      }
      
      // Call original method
      return originalDrawArraysInstanced.call(this, mode, first, count, instanceCount);
    };
  }

  if (originalDrawElementsInstanced) {
    gl.drawElementsInstanced = function(mode, count, type, offset, instanceCount) {
      // Apply noise if this is a significant draw
      if (isSignificantDrawCall(count * instanceCount)) {
        applyNoise();
      }
      
      // Call original method
      return originalDrawElementsInstanced.call(this, mode, count, type, offset, instanceCount);
    };
  }

  // Handle ANGLE instanced extensions
  const angleInstancedArrays = gl.getExtension('ANGLE_instanced_arrays');
  if (angleInstancedArrays) {
    const originalDrawArraysInstancedANGLE = angleInstancedArrays.drawArraysInstancedANGLE;
    const originalDrawElementsInstancedANGLE = angleInstancedArrays.drawElementsInstancedANGLE;
    
    angleInstancedArrays.drawArraysInstancedANGLE = function(mode, first, count, instanceCount) {
      // Apply noise if this is a significant draw
      if (isSignificantDrawCall(count * instanceCount)) {
        applyNoise();
      }
      
      // Call original method
      return originalDrawArraysInstancedANGLE.call(this, mode, first, count, instanceCount);
    };
    
    angleInstancedArrays.drawElementsInstancedANGLE = function(mode, count, type, offset, instanceCount) {
      // Apply noise if this is a significant draw
      if (isSignificantDrawCall(count * instanceCount)) {
        applyNoise();
      }
      
      // Call original method
      return originalDrawElementsInstancedANGLE.call(this, mode, count, type, offset, instanceCount);
    };
  }

  // Log successful installation
  config.log('Draw call spoofing installed');
  
  return true;
}

module.exports = {
  installDrawSpoofing
};