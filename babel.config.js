/**
 * Required by Metro to transform JSX and the modern syntax used throughout
 * src/. Without this file the bundler fails on the first `<View>` it sees.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
