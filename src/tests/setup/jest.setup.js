/**
 * Jest Setup File
 *
 * Global test setup and configuration
 */

import '@testing-library/jest-dom';

global.React = require('react');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

global.wpApiSettings = {
    root: 'https://example.com/wp-json/',
    nonce: 'test-nonce'
};

global.fotogrids = {
    restUrl: 'https://example.com/wp-json/fotogrids/v1/',
    nonce: 'test-nonce',
    settings: {
        lightbox: true,
        lazy_load: true,
        stats_tracking: true
    }
};

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// React dev-mode "key" warnings come from label/badge child arrays in the
// plain render-settings helpers. They are non-breaking reconciliation hints,
// not test failures, so they are filtered here to keep the suite output clean.
// NOTE: act(...) warnings are intentionally NOT filtered - those can indicate
// real timing bugs and should stay visible.
// React logs warnings via printf-style args: console.error(template, ...subs)
// where the component name lands in a later arg (e.g. 'update to %s', 'Root').
// Join everything to a single string before matching so both the template and
// its substitutions are visible to the filters below.
const joinArgs = (args) =>
    args.map((a) => (typeof a === 'string' ? a : '')).join(' ');

// React dev-mode "key" warnings come from label/badge child arrays in the
// plain render-settings helpers. They are non-breaking reconciliation hints,
// not test failures, so they are filtered here to keep the suite output clean.
const isReactKeyWarning = (text) =>
    text.includes('unique "key" prop') ||
    text.includes('Each child in a list should have a unique');

// A handful of admin entry modules bootstrap themselves by calling
// createRoot().render() inside their own setTimeout(0) (toast-init,
// album-assignment, album-galleries). When a test exercises that bootstrap the
// resulting render is owned by the module's timer, not the test, so React emits
// a "not wrapped in act(...)" warning that no amount of test-side flushing can
// remove. Suppress ONLY those specific component updates so genuine act
// warnings elsewhere stay visible.
const TIMER_BOOTSTRAP_COMPONENTS = [
    'ToastApp',
    'AlbumAssignment',
    'AlbumGalleries',
    'Root',
];
const isTimerBootstrapActWarning = (text) =>
    text.includes('was not wrapped in act') &&
    TIMER_BOOTSTRAP_COMPONENTS.some((name) => text.includes(name));

beforeAll(() => {
    console.error = (...args) => {
        const text = joinArgs(args);
        if (text.includes('Warning: ReactDOM.render is deprecated')) {
            return;
        }
        if (isReactKeyWarning(text)) {
            return;
        }
        if (isTimerBootstrapActWarning(text)) {
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

// jsdom has no scrollIntoView - provide a no-op so modules that call it work.
if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function () {};
}

global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

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

Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
        getPropertyValue: () => '',
        columnCount: '3',
        gap: '16px'
    })
});

global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
);

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
