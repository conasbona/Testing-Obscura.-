// src/prng.js

/**
 * A seeded pseudo-random number generator for consistent randomness
 * This ensures fingerprints remain consistent within a session
 */
class SessionPRNG {
  /**
   * Create a new seeded PRNG
   * @param {string|number} seed - The seed value (if not provided, a random one will be generated)
   */
  constructor(seed) {
    this.seed = seed !== undefined ? seed : this._generateSeed();
    this._state = this._initState(this.seed);
  }

  /**
   * Generate a random seed if none provided
   * @private
   * @returns {number} A random seed
   */
  _generateSeed() {
    // Generate a timestamp-based seed with some randomness
    return Date.now() ^ (Math.random() * 0x100000000);
  }

  /**
   * Initialize the PRNG state from a seed
   * @private
   * @param {string|number} seed - The seed value
   * @returns {Array<number>} The initial state array
   */
  _initState(seed) {
    // Convert string seed to number if needed
    let s = seed;
    if (typeof seed === 'string') {
      s = 0;
      for (let i = 0; i < seed.length; i++) {
        s = ((s << 5) - s) + seed.charCodeAt(i);
        s = s >>> 0; // Convert to 32-bit unsigned integer
      }
    }

    // Create a state array of 4 values
    const state = new Array(4);
    
    // Initialize with LCG
    state[0] = s >>> 0;
    state[1] = (s * 69069 + 1) >>> 0;
    state[2] = (state[1] * 69069 + 1) >>> 0;
    state[3] = (state[2] * 69069 + 1) >>> 0;
    
    // Warm up the state
    for (let i = 0; i < 12; i++) {
      this._next(state);
    }
    
    return state;
  }

  /**
   * Advance the PRNG state
   * @private
   * @param {Array<number>} state - The current state array
   * @returns {number} A random 32-bit number
   */
  _next(state = this._state) {
    // Using xorshift128 algorithm
    let t = state[3];
    let s = state[0];
    
    state[3] = state[2];
    state[2] = state[1];
    state[1] = s;
    
    t ^= t << 11;
    t ^= t >>> 8;
    
    state[0] = t ^ s ^ (s >>> 19);
    
    return state[0] >>> 0;
  }

  /**
   * Get a random float between 0 (inclusive) and 1 (exclusive)
   * @returns {number} A random float between 0 and 1
   */
  random() {
    return this._next() / 0x100000000;
  }

  /**
   * Get a random integer between min (inclusive) and max (inclusive)
   * @param {number} min - The minimum value
   * @param {number} max - The maximum value
   * @returns {number} A random integer in the specified range
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Get a random float between min (inclusive) and max (exclusive)
   * @param {number} min - The minimum value
   * @param {number} max - The maximum value
   * @returns {number} A random float in the specified range
   */
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /**
   * Select a random item from an array
   * @param {Array} array - The array to select from
   * @returns {*} A random item from the array
   */
  randomChoice(array) {
    if (!array || array.length === 0) {
      return undefined;
    }
    const index = this.randomInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Shuffle an array in-place using Fisher-Yates algorithm
   * @param {Array} array - The array to shuffle
   * @returns {Array} The shuffled array (same reference)
   */
  shuffle(array) {
    if (!array || array.length <= 1) {
      return array;
    }
    
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    
    return array;
  }

  /**
   * Create a sub-generator with a derived seed
   * Useful for consistent but different randomness in different contexts
   * @param {string} context - A context string to mix with the original seed
   * @returns {SessionPRNG} A new PRNG with a derived seed
   */
  deriveGenerator(context) {
    const childSeed = `${this.seed}-${context}`;
    return new SessionPRNG(childSeed);
  }

  /**
 * Get the current seed
 * @returns {string|number} The seed value
 */
getSeed() {
  return this.seed;
}
}

module.exports = SessionPRNG;