// mobile/ is a standalone install (NOT an npm workspace) to keep the React
// Native dependency tree flat and self-contained — hoisting it alongside the
// web client nests expo-modules-core out of Metro's resolver. Default config
// resolves everything from mobile/node_modules.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
