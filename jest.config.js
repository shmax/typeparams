module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1", // Fixes Jest module resolution for TypeScript
  },
};

