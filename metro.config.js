const { getDefaultConfig } = require('expo/metro-config');

// Since we are now using PNG assets (not SVG components), the default config is enough
module.exports = getDefaultConfig(__dirname);
