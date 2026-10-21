// @ts-check
/** Jest resolver applying the same monorepo rule as Metro (see ./mobile-first.js). */
const path = require('path');
const { projectRoot, shouldPreferMobile } = require('./mobile-first');

// npm nests some Expo internals under `expo/node_modules` (e.g. expo-modules-core). Metro finds
// them through `expo`'s own imports; jest-expo's setup imports them by bare name, so fall back to
// resolving from the `expo` package directory.
const expoDir = path.dirname(require.resolve('expo/package.json', { paths: [projectRoot] }));

/**
 * @param {string} request
 * @param {{ basedir: string, defaultResolver: (req: string, opts: object) => string }} options
 */
module.exports = (request, options) => {
  const opts = shouldPreferMobile(request, path.join(options.basedir, 'index.js'))
    ? { ...options, basedir: projectRoot }
    : options;
  try {
    return options.defaultResolver(request, opts);
  } catch (error) {
    if (request.startsWith('.') || path.isAbsolute(request)) throw error;
    return options.defaultResolver(request, { ...options, basedir: expoDir });
  }
};
