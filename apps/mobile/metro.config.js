const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const protocolRoot = path.resolve(projectRoot, '../../packages/protocol');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [protocolRoot];
config.resolver.extraNodeModules = {
  '@salbar/protocol': protocolRoot,
};

module.exports = config;
