'use strict';
process.env.TS_NODE_FILES = true;
module.exports = {
  'allow-uncaught': true,
  diff: true,
  extension: ['ts'],
  recursive: true,
  reporter: 'spec',
  require: ['ts-node/register', 'hardhat/register'], // ['ts-node/register/transpile-only'], (for yarn link <plugin>)
  slow: 300,
  spec: 'test/**/*.test.ts',
  timeout: 20000,
  ui: 'bdd',
  watch: false,
  exit: true,
  'watch-files': ['src/**/*.sol', 'test/**/*.ts'],
  bail: true,
  recursive: true,
};
