// @ts-check
/**
 * Monorepo resolution guard shared by Metro (metro.config.js) and Jest (tooling/jest-resolver.js).
 *
 * The web app pins React 18 at the workspace root while Expo SDK 58 needs React 19.3 and
 * React Native 0.88. npm therefore installs the mobile copies in `apps/mobile/node_modules` and
 * hoists the rest of the Expo packages to the root, where a plain Node lookup would pick React 18
 * (and a stale react-native). Two Reacts in one bundle crash at runtime ("Invalid hook call").
 *
 * Rule: when a file OUTSIDE apps/mobile imports a bare package that also exists in
 * apps/mobile/node_modules, resolve it from apps/mobile instead. Files inside apps/mobile keep the
 * normal hierarchical lookup (so nested node_modules still win).
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const mobileModules = path.join(projectRoot, 'node_modules');

/** `@scope/name/sub/path` -> `@scope/name`, `name/sub` -> `name`; null for relative/absolute. */
function packageNameOf(request) {
  if (request.startsWith('.') || path.isAbsolute(request)) return null;
  const parts = request.split('/');
  if (request.startsWith('@')) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  return parts[0] ?? null;
}

const cache = new Map();
function hasMobileCopy(pkg) {
  let hit = cache.get(pkg);
  if (hit === undefined) {
    hit = fs.existsSync(path.join(mobileModules, pkg, 'package.json'));
    cache.set(pkg, hit);
  }
  return hit;
}

/** True when `request` imported from `originPath` must be redirected to the mobile copy. */
function shouldPreferMobile(request, originPath) {
  const pkg = packageNameOf(request);
  if (!pkg || !hasMobileCopy(pkg)) return false;
  const rel = path.relative(projectRoot, originPath);
  const insideMobile = !rel.startsWith('..') && !path.isAbsolute(rel);
  return !insideMobile;
}

module.exports = { projectRoot, mobileModules, shouldPreferMobile };
