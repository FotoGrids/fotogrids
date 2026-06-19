/**
 * Jest Configuration for FotoGrids
 *
 * Testing configuration for both PHP and JavaScript/TypeScript code
 */

module.exports = {
    testEnvironment: 'jsdom',

    setupFilesAfterEnv: [
        '<rootDir>/src/tests/setup/jest.setup.js'
    ],

    roots: [
        '<rootDir>/src'
    ],

    testMatch: [
        '<rootDir>/src/tests/**/*.test.{js,ts,tsx}',
        '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
        '<rootDir>/src/**/*.{test,spec}.{js,ts,tsx}'
    ],

    moduleFileExtensions: [
        'js',
        'jsx',
        'ts',
        'tsx',
        'json'
    ],

    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
        '^.+\\.css$': '<rootDir>/src/tests/setup/cssTransform.js',
        '^.+\\.scss$': '<rootDir>/src/tests/setup/cssTransform.js',
        '^.+\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/src/tests/setup/fileTransform.js'
    },

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/assets/$1',
        '^@tests/(.*)$': '<rootDir>/src/tests/$1',
        '^@modules/(.*)$': '<rootDir>/src/includes/modules/$1'
    },

    collectCoverageFrom: [
        'src/assets/**/*.{js,ts,tsx}',
        '!src/assets/**/*.d.ts',
        '!src/assets/**/index.{js,ts}',
        '!src/assets/**/*.stories.{js,ts,tsx}',
        '!src/assets/admin/plain/icons.js',
        '!src/tests/**/*'
    ],

    coverageThreshold: {
        global: {
            branches: 70,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },

    coverageReporters: [
        'text',
        'lcov',
        'html',
        'json-summary'
    ],

    coverageDirectory: '<rootDir>/coverage',

    clearMocks: true,

    restoreMocks: true,

    verbose: true,

    testTimeout: 10000,

    globalSetup: '<rootDir>/src/tests/setup/globalSetup.js',
    globalTeardown: '<rootDir>/src/tests/setup/globalTeardown.js',

    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json'
        },
        wp: {},
        wpApiSettings: {
            root: 'https://example.com/wp-json/',
            nonce: 'test-nonce'
        },
        fotogrids: {
            restUrl: 'https://example.com/wp-json/fotogrids/v1/',
            nonce: 'test-nonce',
            settings: {}
        }
    }
};
