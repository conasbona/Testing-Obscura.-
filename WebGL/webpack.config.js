// webpack.config.js (updated)
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development', // Change to 'production' for production build
  entry: './src/browser-entry.js', // We'll create this file
  output: {
    filename: 'webgl-protection.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  target: 'web',
  devtool: 'source-map',
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ]
};