const path = require('node:path');

const sharedModuleNameMapper = {
  '^@supermarket/shared-domain$': '<rootDir>/../../libs/shared-domain/src/index.ts',
  '^@supermarket/shared-domain/(.*)$': '<rootDir>/../../libs/shared-domain/src/$1',
  '^@supermarket/shared-infra$': '<rootDir>/../../libs/shared-infra/src/index.ts',
  '^@supermarket/shared-infra/(.*)$': '<rootDir>/../../libs/shared-infra/src/$1'
};

const createProjectConfig = ({
  coverageDirectory,
  displayName,
  rootDir,
  testMatch,
  testPathIgnorePatterns,
  tsconfig
}) => ({
  displayName,
  preset: 'ts-jest',
  rootDir: path.join(__dirname, rootDir),
  testEnvironment: 'node',
  testMatch: [testMatch],
  ...(testPathIgnorePatterns ? { testPathIgnorePatterns } : {}),
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig,
        diagnostics: false
      }
    ]
  },
  moduleNameMapper: {
    '^#/(.*)$': '<rootDir>/src/$1',
    ...sharedModuleNameMapper
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  coverageDirectory
});

module.exports = {
  projects: [
    createProjectConfig({
      displayName: 'unit:checkout-service',
      rootDir: 'apps/checkout-service',
      testMatch: '<rootDir>/test/**/*.spec.ts',
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/unit/checkout-service')
    }),
    createProjectConfig({
      displayName: 'unit:management-service',
      rootDir: 'apps/management-service',
      testMatch: '<rootDir>/test/**/*.spec.ts',
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/unit/management-service')
    }),
    createProjectConfig({
      displayName: 'unit:shared-domain',
      rootDir: 'libs/shared-domain',
      testMatch: '<rootDir>/test/**/*.spec.ts',
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/unit/shared-domain')
    }),
    createProjectConfig({
      displayName: 'unit:shared-infra',
      rootDir: 'libs/shared-infra',
      testMatch: '<rootDir>/test/**/*.spec.ts',
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/unit/shared-infra')
    }),
    createProjectConfig({
      displayName: 'e2e:checkout-service',
      rootDir: 'apps/checkout-service',
      testMatch: '<rootDir>/test/**/*.e2e-spec.ts',
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/e2e/checkout-service')
    }),
    createProjectConfig({
      displayName: 'e2e:inventory-service',
      rootDir: 'apps/inventory-service',
      testMatch: '<rootDir>/test/**/*.e2e-spec.ts',
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/e2e/inventory-service')
    }),
    createProjectConfig({
      displayName: 'e2e:management-service',
      rootDir: 'apps/management-service',
      testMatch: '<rootDir>/test/**/*.e2e-spec.ts',
      tsconfig: '<rootDir>/tsconfig.spec.json',
      coverageDirectory: path.join(__dirname, 'coverage/e2e/management-service')
    })
  ]
};
