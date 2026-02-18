const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver to ignore web-only imports for React Native
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Ignore CSS imports and web-only modules for native platforms
    if (platform !== 'web') {
      if (
        moduleName.endsWith('.css') ||
        moduleName.includes('.css') ||
        moduleName === 'mapbox-gl' ||
        moduleName.startsWith('mapbox-gl/')
      ) {
        // Return an empty module for CSS and mapbox-gl imports on native
        return {
          type: 'empty',
        };
      }
    }

    // Use default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
