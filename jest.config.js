const mapper = require('jest-module-name-mapper');
module.exports = {
    verbose: true,
    clearMocks: true,
    maxWorkers: 1,
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleDirectories: ['node_modules', 'src'],
    coveragePathIgnorePatterns: ["<rootDir>/build/", "<rootDir>/node_modules/"],
    testMatch: [
        '**/__tests__/**/*.[jt]s?(x)',
        '!**/__tests__/coverage/**',
        '!**/__tests__/utils/**',
        '!**/__tests__/images/**',
    ],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    moduleNameMapper: mapper
};
