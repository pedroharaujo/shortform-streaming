const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Opt-in local workaround for Expo #49111: Android can reject large multipart
// development bundles on Windows. Keep store builds and other requests unchanged.
// eslint-disable-next-line no-restricted-syntax -- Metro runs in Node; this local server flag is never bundled.
if (process.env.SHORTFORM_METRO_PLAIN_ANDROID_BUNDLE === '1') {
  const enhance = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware, server) => {
    const next = enhance ? enhance(middleware, server) : middleware;
    return (request, response, nextMiddleware) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.endsWith('.bundle') && url.searchParams.get('platform') === 'android') {
        request.headers.accept = 'application/javascript';
      }
      return next(request, response, nextMiddleware);
    };
  };
}

module.exports = config;
