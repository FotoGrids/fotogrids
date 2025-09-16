/**
 * Test Data Fixtures
 * 
 * Sample data for testing FotoGrids components
 */

export const mockGalleries = [
    {
        id: 1,
        title: 'Summer Vacation 2023',
        image_count: 24,
        featured_image: 'https://example.com/images/summer-vacation-featured.jpg',
        created: '2023-06-15T10:30:00Z',
        modified: '2023-06-20T14:45:00Z'
    },
    {
        id: 2,
        title: 'Wedding Photography',
        image_count: 156,
        featured_image: 'https://example.com/images/wedding-featured.jpg',
        created: '2023-05-20T09:00:00Z',
        modified: '2023-05-21T16:30:00Z'
    },
    {
        id: 3,
        title: 'Nature Landscapes',
        image_count: 8,
        featured_image: null,
        created: '2023-04-10T11:15:00Z',
        modified: '2023-04-12T08:20:00Z'
    },
    {
        id: 4,
        title: 'Product Photography',
        image_count: 45,
        featured_image: 'https://example.com/images/product-featured.jpg',
        created: '2023-03-05T13:45:00Z',
        modified: '2023-03-08T10:10:00Z'
    }
];

export const mockImages = [
    {
        id: 101,
        position: 1,
        caption: 'Beautiful sunset over the ocean',
        description: 'A stunning sunset captured during our beach vacation',
        url: 'https://example.com/images/sunset-ocean.jpg',
        thumbnail: 'https://example.com/images/sunset-ocean-150x150.jpg',
        medium: 'https://example.com/images/sunset-ocean-300x300.jpg',
        large: 'https://example.com/images/sunset-ocean-1024x1024.jpg',
        full: 'https://example.com/images/sunset-ocean-full.jpg',
        alt: 'Sunset over ocean waves',
        title: 'Ocean Sunset'
    },
    {
        id: 102,
        position: 2,
        caption: 'Mountain hiking trail',
        description: 'A scenic trail through the mountains',
        url: 'https://example.com/images/mountain-trail.jpg',
        thumbnail: 'https://example.com/images/mountain-trail-150x150.jpg',
        medium: 'https://example.com/images/mountain-trail-300x300.jpg',
        large: 'https://example.com/images/mountain-trail-1024x1024.jpg',
        full: 'https://example.com/images/mountain-trail-full.jpg',
        alt: 'Winding mountain hiking trail',
        title: 'Mountain Trail'
    },
    {
        id: 103,
        position: 3,
        caption: 'City skyline at night',
        description: 'Downtown city lights illuminating the skyline',
        url: 'https://example.com/images/city-skyline.jpg',
        thumbnail: 'https://example.com/images/city-skyline-150x150.jpg',
        medium: 'https://example.com/images/city-skyline-300x300.jpg',
        large: 'https://example.com/images/city-skyline-1024x1024.jpg',
        full: 'https://example.com/images/city-skyline-full.jpg',
        alt: 'City skyline with illuminated buildings',
        title: 'Night Skyline'
    },
    {
        id: 104,
        position: 4,
        caption: '',
        description: '',
        url: 'https://example.com/images/no-caption.jpg',
        thumbnail: 'https://example.com/images/no-caption-150x150.jpg',
        medium: 'https://example.com/images/no-caption-300x300.jpg',
        large: 'https://example.com/images/no-caption-1024x1024.jpg',
        full: 'https://example.com/images/no-caption-full.jpg',
        alt: 'Image without caption',
        title: 'Untitled Image'
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
        description: 'Pinterest-style masonry layout preserving image aspect ratios',
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
        description: 'Image slider with navigation controls and autoplay',
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
        customCSS: '.fotogrids-gallery { border: 2px solid red; }',
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
    images: {
        success: mockImages,
        empty: [],
        limited: mockImages.slice(0, 2),
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
    image_count: 5,
    featured_image: 'https://example.com/image.jpg',
    created: '2023-01-01T00:00:00Z',
    modified: '2023-01-01T00:00:00Z',
    ...overrides
});

export const createMockImage = (overrides = {}) => ({
    id: 1,
    position: 1,
    caption: 'Test Image',
    description: 'Test Description',
    url: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/image-150x150.jpg',
    medium: 'https://example.com/image-300x300.jpg',
    large: 'https://example.com/image-1024x1024.jpg',
    full: 'https://example.com/image.jpg',
    alt: 'Test Alt Text',
    title: 'Test Image Title',
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
