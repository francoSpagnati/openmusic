// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const { projectRoot, shouldPreferMobile } = require('./tooling/mobile-first');

/** Expo SDK 58 configures monorepo watchFolders/nodeModulesPaths automatically. */
const config = getDefaultConfig(projectRoot);

const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ctx = shouldPreferMobile(moduleName, context.originModulePath)
    ? { ...context, originModulePath: `${projectRoot}/package.json` }
    : context;
  return upstreamResolve
    ? upstreamResolve(ctx, moduleName, platform)
    : ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;
