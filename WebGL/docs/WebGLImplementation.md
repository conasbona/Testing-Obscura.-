WebGL Fingerprinting Spoofing Module: Implementation Plan (v1)

🌟 Objective

Manipulate WebGL fingerprinting outputs by modifying rendered content—not spoofing API return values. The system introduces session-consistent, shader-based visual perturbations that distort identifiable patterns in WebGL fingerprinting without breaking rendering.

📂 File Structure

webgl/
├── index.js                # Entrypoint: setup, patching logic
├── hooks.js                # Hooks for draw calls, readPixels, toDataURL
├── shader.js               # Fragment shader for pixel-level noise injection
├── prng.js                 # Standalone PRNG seeded per session
├── state.js                # Context-level render state tracking
├── config.js               # Debug flag and noise configuration

🔧 Hook Targets

Function

Purpose

Action

HTMLCanvasElement.getContext

Detect WebGL/WebGL2 context creation

Wrap and track new gl context instances

gl.drawArrays / gl.drawElements

Fingerprintable draw calls

Inject noise fragment shader before draw

gl.readPixels

Image hash origin

Apply pixel-level fallback noise if needed

canvas.toDataURL()

Canvas serialization

Re-render with noise if no draw happened

♻️ Runtime Flow

1. Initialization

Executed via Playwright using context.add_init_script()

Accepts or generates sessionSeed

Installs all core hooks

2. Context Wrapping

On getContext('webgl') or 'webgl2':

Hooks drawArrays, drawElements, readPixels

Injects state trackers

3. Draw Behavior

Hooked draw calls:

Inject shader with PRNG-based noise uniform

Overlay full-frame quad

Restore site-defined GL state post-draw

4. Output Behavior

If readPixels or toDataURL called without a recorded draw:

Apply fallback pixel noise (buffer-level mutation)

🌀 PRNG System

Session-seeded deterministic PRNG (createPRNG(sessionSeed))

Used for:

Noise uniform in shaders

Fallback pixel mutation

Entropy stability across calls

🎨 Shader Module (shader.js)

GLSL fragment shader with:

Uniform u_noiseSeed

Grid or sine-based pixel variation

Optional alpha jitter

Compiled and injected automatically before draw

⚙️ Config Module (config.js)

export const DEBUG_MODE = true;

export const noiseConfig = {
  rgbJitter: 0.04,           // Max ± offset for R/G/B channels
  alphaJitter: 0.05,         // Alpha channel reduction (optional)
  shaderNoiseGranularity: 32 // Pixel size for grid variation
};

🔐 State Tracking

Per-context metadata tracked:

Has draw occurred?

Has shader noise been injected?

Was fallback noise applied?

🔧 Test Matrix

Site

Expected Result

https://amiunique.org/fp

Session-unique WebGL image hash

https://browserleaks.com/webgl

Altered WebGL image + device stats

https://fingerprint.com/demo

Different ID every browser session

✅ Output Guarantees

Deterministic, session-stable perturbation of WebGL outputs

Visual distortion of GPU-rendered canvases

Compatibility with all unmodified rendering pipelines

Avoids risky value spoofing (e.g., getParameter tampering)

Easy integration with existing anti-fingerprinting stack (e.g., canvas module)

🔄 Next Steps

Implement index.js + hooks.js scaffolding

Create and validate shader noise module

Patch draw and output functions

Verify against live fingerprinting testbeds

Approved and designed for MVP-grade spoofing across session-based Playwright launches.

