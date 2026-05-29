const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// Firebase usa el campo "exports" de package.json con condiciones browser/node/react-native.
// Metro resuelve incorrectamente la variante browser (que no exporta getReactNativePersistence).
// Deshabilitando packageExports, Metro usa el campo "main" clásico que sí incluye RN.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
