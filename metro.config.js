/* eslint-env node */
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

// Force `three` to resolve to the WebGPU build everywhere. The classic
// `three` entry uses the WebGL renderer; `three/webgpu` exposes the same
// API surface plus `WebGPURenderer` and the node-material system.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let resolvedName = moduleName;
  if (moduleName === "three") {
    resolvedName = "three/webgpu";
  }
  const next = originalResolveRequest ?? context.resolveRequest;
  return next(context, resolvedName, platform);
};

module.exports = config;
