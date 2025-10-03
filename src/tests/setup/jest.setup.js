/**
 * Jest Setup File
 * 
 * Global test setup and configuration
 */

import '@testing-library/jest-dom';

// Mock WordPress globals
global.wp = {
    element: require('@wordpress/element'),
    components: require('@wordpress/components'),
    data: require('@wordpress/data'),
    apiFetch: jest.fn(),
    i18n: {
        __: jest.fn((text) => text),
        _n: jest.fn((single, plural, number) => number === 1 ? single : plural),
        _x: jest.fn((text) => text),
        sprintf: jest.fn((format, ...args) => format)
    },
    blocks: {
        registerBlockType: jest.fn(),
        createBlock: jest.fn()
    },
    blockEditor: require('@wordpress/block-editor'),
    hooks: {
        addFilter: jest.fn(),
        addAction: jest.fn(),
        doAction: jest.fn(),
        applyFilters: jest.fn((hook, value) => value)
    }
};

// Mock WordPress API settings
global.wpApiSettings = {
    root: 'https://example.com/wp-json/',
    nonce: 'test-nonce'
};

// Mock FotoGrids globals
global.fotogrids = {
    restUrl: 'https://example.com/wp-json/fotogrids/v1/',
    nonce: 'test-nonce',
    settings: {
        lightbox: true,
        lazy_load: true,
        stats_tracking: true
    }
};

// Mock console methods in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.error = (...args) => {
        if (
            typeof args[0] === 'string' &&
            args[0].includes('Warning: ReactDOM.render is deprecated')
        ) {
            return;
        }
        originalConsoleError.call(console, ...args);
    };
    
    console.warn = (...args) => {
        if (
            typeof args[0] === 'string' &&
            (
                args[0].includes('componentWillReceiveProps') ||
                args[0].includes('componentWillMount')
            )
        ) {
            return;
        }
        originalConsoleWarn.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock window.getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
        getPropertyValue: () => '',
        columnCount: '3',
        gap: '16px'
    })
});

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
);

// Setup test utilities
export const createMockGallery = (overrides = {}) => ({
    id: 1,
    title: 'Test Gallery',
    item_count: 5,
    featured_item: 'https://example.com/item.jpg',
    created: '2023-01-01T00:00:00Z',
    modified: '2023-01-01T00:00:00Z',
    ...overrides
});

export const createMockItem = (overrides = {}) => ({
    id: 1,
    position: 1,
    caption: 'Test Item',
    description: 'Test Description',
    url: 'https://example.com/item.jpg',
    thumbnail: 'https://example.com/item-150x150.jpg',
    medium: 'https://example.com/item-300x300.jpg',
    large: 'https://example.com/item-1024x1024.jpg',
    full: 'https://example.com/item.jpg',
    alt: 'Test Alt Text',
    title: 'Test Item Title',
    ...overrides
});

export const createMockTemplate = (overrides = {}) => ({
    id: 'grid',
    name: 'Grid',
    description: 'Simple grid layout',
    type: 'free',
    preview: 'https://example.com/preview.jpg',
    ...overrides
});
