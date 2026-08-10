/**
 * Default Expo Metro config.
 *
 * Present explicitly because this project relies on platform extensions —
 * services/firebase.web.js is chosen over services/firebase.js when bundling
 * for web. That behavior is built in, but having the file here means there's
 * somewhere obvious to look when resolution misbehaves.
 */
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
