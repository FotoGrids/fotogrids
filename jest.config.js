/**
 * Jest Configuration for FotoGrids
 * 
 * Testing configuration for both PHP and JavaScript/TypeScript code
 */

module.exports = {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Setup files
    setupFilesAfterEnv: [
        '<rootDir>/src/tests/setup/jest.setup.js'
    ],
    
    // Module paths
    roots: [
        '<rootDir>/src'
    ],
    
    // Test patterns
    testMatch: [
        '<rootDir>/src/tests/**/*.test.{js,ts,tsx}',
        '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
        '<rootDir>/src/**/*.{test,spec}.{js,ts,tsx}'
    ],
    
    // File extensions to consider
    moduleFileExtensions: [
        'js',
        'jsx',
        'ts',
        'tsx',
        'json'
    ],
    
    // Transform files
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
        '^.+\\.css$': '<rootDir>/src/tests/setup/cssTransform.js',
        '^.+\\.scss$': '<rootDir>/src/tests/setup/cssTransform.js',
        '^.+\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/src/tests/setup/fileTransform.js'
    },
    
    // Module name mapping
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/assets/$1',
        '^@tests/(.*)$': '<rootDir>/src/tests/$1'
    },
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/assets/**/*.{js,ts,tsx}',
        '!src/assets/**/*.d.ts',
        '!src/assets/**/index.{js,ts}',
        '!src/assets/**/*.stories.{js,ts,tsx}',
        '!src/tests/**/*'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Coverage reporters
    coverageReporters: [
        'text',
        'lcov',
        'html',
        'json-summary'
    ],
    
    // Coverage directory
    coverageDirectory: '<rootDir>/coverage',
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks after each test
    restoreMocks: true,
    
    // Verbose output
    verbose: true,
    
    // Test timeout
    testTimeout: 10000,
    
    // Global setup/teardown
    globalSetup: '<rootDir>/src/tests/setup/globalSetup.js',
    globalTeardown: '<rootDir>/src/tests/setup/globalTeardown.js',
    
    // WordPress globals
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json'
        },
        // WordPress global variables
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
