const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

const moduleNameMapper = pathsToModuleNameMapper(compilerOptions.paths, {
  prefix: '<rootDir>/'
});

module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/{apps,libs}/**/test/**/*.spec.ts'],
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.json',
            diagnostics: false
          }
        ]
      },
      moduleNameMapper,
      moduleFileExtensions: ['js', 'json', 'ts'],
      coverageDirectory: '<rootDir>/coverage/unit'
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/apps/**/test/**/*.e2e-spec.ts'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.json',
            diagnostics: false
          }
        ]
      },
      moduleNameMapper,
      moduleFileExtensions: ['js', 'json', 'ts'],
      coverageDirectory: '<rootDir>/coverage/e2e'
    }
  ]
};
