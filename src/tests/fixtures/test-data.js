/**
 * Test Data Fixtures
 * 
 * Sample data for testing FotoGrids components
 */

export const mockGalleries = [
    {
        id: 1,
        title: 'Summer Vacation 2023',
        item_count: 24,
        featured_item: 'https://example.com/items/summer-vacation-featured.jpg',
        created: '2023-06-15T10:30:00Z',
        modified: '2023-06-20T14:45:00Z'
    },
    {
        id: 2,
        title: 'Wedding Photography',
        item_count: 156,
        featured_item: 'https://example.com/items/wedding-featured.jpg',
        created: '2023-05-20T09:00:00Z',
        modified: '2023-05-21T16:30:00Z'
    },
    {
        id: 3,
        title: 'Nature Landscapes',
        item_count: 8,
        featured_item: null,
        created: '2023-04-10T11:15:00Z',
        modified: '2023-04-12T08:20:00Z'
    },
    {
        id: 4,
        title: 'Product Photography',
        item_count: 45,
        featured_item: 'https://example.com/items/product-featured.jpg',
        created: '2023-03-05T13:45:00Z',
        modified: '2023-03-08T10:10:00Z'
    }
];

export const mockItems = [
    {
        id: 101,
        position: 1,
        caption: 'Beautiful sunset over the ocean',
        description: 'A stunning sunset captured during our beach vacation',
        url: 'https://example.com/items/sunset-ocean.jpg',
        thumbnail: 'https://example.com/items/sunset-ocean-150x150.jpg',
        medium: 'https://example.com/items/sunset-ocean-300x300.jpg',
        large: 'https://example.com/items/sunset-ocean-1024x1024.jpg',
        full: 'https://example.com/items/sunset-ocean-full.jpg',
        alt: 'Sunset over ocean waves',
        title: 'Ocean Sunset'
    },
    {
        id: 102,
        position: 2,
        caption: 'Mountain hiking trail',
        description: 'A scenic trail through the mountains',
        url: 'https://example.com/items/mountain-trail.jpg',
        thumbnail: 'https://example.com/items/mountain-trail-150x150.jpg',
        medium: 'https://example.com/items/mountain-trail-300x300.jpg',
        large: 'https://example.com/items/mountain-trail-1024x1024.jpg',
        full: 'https://example.com/items/mountain-trail-full.jpg',
        alt: 'Winding mountain hiking trail',
        title: 'Mountain Trail'
    },
    {
        id: 103,
        position: 3,
        caption: 'City skyline at night',
        description: 'Downtown city lights illuminating the skyline',
        url: 'https://example.com/items/city-skyline.jpg',
        thumbnail: 'https://example.com/items/city-skyline-150x150.jpg',
        medium: 'https://example.com/items/city-skyline-300x300.jpg',
        large: 'https://example.com/items/city-skyline-1024x1024.jpg',
        full: 'https://example.com/items/city-skyline-full.jpg',
        alt: 'City skyline with illuminated buildings',
        title: 'Night Skyline'
    },
    {
        id: 104,
        position: 4,
        caption: '',
        description: '',
        url: 'https://example.com/items/no-caption.jpg',
        thumbnail: 'https://example.com/items/no-caption-150x150.jpg',
        medium: 'https://example.com/items/no-caption-300x300.jpg',
        large: 'https://example.com/items/no-caption-1024x1024.jpg',
        full: 'https://example.com/items/no-caption-full.jpg',
        alt: 'Item without caption',
        title: 'Untitled Item'
    }
];

export const mockTemplates = [
    {
        id: 'grid',
        name: 'Grid',
        description: 'Simple responsive grid layout with equal-sized squares',
        type: 'free',
        preview: 'https://example.com/previews/grid-preview.jpg'
    },
    {
        id: 'masonry',
        name: 'Masonry',
        description: 'Pinterest-style masonry layout preserving item aspect ratios',
        type: 'free',
        preview: 'https://example.com/previews/masonry-preview.jpg'
    },
    {
        id: 'justified',
        name: 'Justified',
        description: 'Justified rows with equal heights, similar to Google Photos',
        type: 'free',
        preview: 'https://example.com/previews/justified-preview.jpg'
    },
    {
        id: 'slider',
        name: 'Slider',
        description: 'Item slider with navigation controls and autoplay',
        type: 'starter',
        preview: 'https://example.com/previews/slider-preview.jpg'
    },
    {
        id: 'polaroid',
        name: 'Polaroid',
        description: 'Polaroid-style scattered photo layout with vintage effects',
        type: 'starter',
        preview: 'https://example.com/previews/polaroid-preview.jpg'
    },
    {
        id: 'carousel',
        name: 'Carousel',
        description: 'Advanced carousel with thumbnails and smooth transitions',
        type: 'expert',
        preview: 'https://example.com/previews/carousel-preview.jpg'
    },
    {
        id: 'lightbox-pro',
        name: 'Lightbox Pro',
        description: 'Enhanced lightbox with social sharing and EXIF data',
        type: 'expert',
        preview: 'https://example.com/previews/lightbox-pro-preview.jpg'
    },
    {
        id: 'woocommerce',
        name: 'WooCommerce Gallery',
        description: 'Product gallery integration with WooCommerce',
        type: 'commerce',
        preview: 'https://example.com/previews/woocommerce-preview.jpg'
    }
];

export const mockBlockAttributes = {
    default: {
        galleryId: 0,
        template: 'grid',
        columns: 3,
        showCaptions: true,
        lightbox: true,
        lazyLoad: true,
        align: 'none'
    },
    grid: {
        galleryId: 1,
        template: 'grid',
        columns: 4,
        showCaptions: true,
        lightbox: true,
        lazyLoad: true,
        align: 'center'
    },
    masonry: {
        galleryId: 2,
        template: 'masonry',
        columns: 3,
        showCaptions: false,
        lightbox: true,
        lazyLoad: true,
        align: 'wide'
    },
    justified: {
        galleryId: 3,
        template: 'justified',
        columns: 2, // Row height setting
        showCaptions: true,
        lightbox: false,
        lazyLoad: true,
        align: 'full'
    },
    withCustomCSS: {
        galleryId: 1,
        template: 'grid',
        columns: 3,
        showCaptions: true,
        lightbox: true,
        lazyLoad: true,
        customCSS: '.fotogrids-collection { border: 2px solid red; }',
        align: 'none'
    }
};

export const mockApiResponses = {
    galleries: {
        success: mockGalleries,
        empty: [],
        error: {
            code: 'rest_no_route',
            message: 'No route was found matching the URL and request method',
            data: { status: 404 }
        }
    },
    items: {
        success: mockItems,
        empty: [],
        limited: mockItems.slice(0, 2),
        notFound: {
            code: 'gallery_not_found',
            message: 'Gallery not found.',
            data: { status: 404 }
        }
    },
    templates: {
        success: mockTemplates,
        freeOnly: mockTemplates.filter(t => t.type === 'free'),
        proOnly: mockTemplates.filter(t => t.type !== 'free')
    },
    stats: {
        success: { success: true },
        error: {
            code: 'rest_forbidden',
            message: 'You are not allowed to access this resource',
            data: { status: 403 }
        }
    }
};

export const mockWordPressGlobals = {
    wp: {
        element: {},
        components: {},
        data: {},
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
        blockEditor: {},
        hooks: {
            addFilter: jest.fn(),
            addAction: jest.fn(),
            doAction: jest.fn(),
            applyFilters: jest.fn((hook, value) => value)
        }
    },
    wpApiSettings: {
        root: 'https://example.com/wp-json/',
        nonce: 'test-nonce-12345'
    },
    fotogrids: {
        restUrl: 'https://example.com/wp-json/fotogrids/v1/',
        nonce: 'fotogrids-nonce-12345',
        settings: {
            lightbox: true,
            lazy_load: true,
            stats_tracking: true
        }
    }
};

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

export const createMockBlockAttributes = (overrides = {}) => ({
    galleryId: 1,
    template: 'grid',
    columns: 3,
    showCaptions: true,
    lightbox: true,
    lazyLoad: true,
    align: 'none',
    ...overrides
});
