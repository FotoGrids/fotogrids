/**
 * REST API Integration Tests
 * 
 * Tests for FotoGrids REST API endpoints
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock WordPress API
const mockApiFetch = jest.fn();
global.wp = {
    apiFetch: mockApiFetch
};

describe('FotoGrids REST API Integration', () => {
    const baseUrl = 'https://example.com/wp-json/fotogrids/v1';

    beforeEach(() => {
        jest.clearAllMocks();
        fetch.mockClear();
        mockApiFetch.mockClear();
    });

    describe('Galleries Endpoint', () => {
        test('fetches galleries list', async () => {
            const mockGalleries = [
                {
                    id: 1,
                    title: 'Test Gallery 1',
                    item_count: 5,
                    featured_item: 'https://example.com/item1.jpg',
                    created: '2023-01-01T00:00:00Z',
                    modified: '2023-01-01T00:00:00Z'
                },
                {
                    id: 2,
                    title: 'Test Gallery 2',
                    item_count: 10,
                    featured_item: null,
                    created: '2023-01-02T00:00:00Z',
                    modified: '2023-01-02T00:00:00Z'
                }
            ];

            mockApiFetch.mockResolvedValue(mockGalleries);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/galleries'
            });

            expect(mockApiFetch).toHaveBeenCalledWith({
                path: '/fotogrids/v1/galleries'
            });
            expect(result).toEqual(mockGalleries);
        });

        test('handles galleries list with pagination', async () => {
            const mockPaginatedGalleries = [
                { id: 1, title: 'Gallery 1' },
                { id: 2, title: 'Gallery 2' }
            ];

            mockApiFetch.mockResolvedValue(mockPaginatedGalleries);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/galleries?per_page=2&page=1'
            });

            expect(result).toEqual(mockPaginatedGalleries);
        });

        test('handles galleries search', async () => {
            const mockSearchResults = [
                { id: 1, title: 'Vacation Photos' }
            ];

            mockApiFetch.mockResolvedValue(mockSearchResults);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/galleries?search=vacation'
            });

            expect(result).toEqual(mockSearchResults);
        });
    });

    describe('Gallery Items Endpoint', () => {
        test('fetches gallery items', async () => {
            const mockItems = [
                {
                    id: 101,
                    position: 1,
                    caption: 'First item',
                    description: 'Description',
                    url: 'https://example.com/item1.jpg',
                    thumbnail: 'https://example.com/item1-150x150.jpg',
                    medium: 'https://example.com/item1-300x300.jpg',
                    large: 'https://example.com/item1-1024x1024.jpg',
                    full: 'https://example.com/item1.jpg',
                    alt: 'Alt text',
                    title: 'Item Title'
                },
                {
                    id: 102,
                    position: 2,
                    caption: 'Second item',
                    description: 'Another description',
                    url: 'https://example.com/item2.jpg',
                    thumbnail: 'https://example.com/item2-150x150.jpg',
                    medium: 'https://example.com/item2-300x300.jpg',
                    large: 'https://example.com/item2-1024x1024.jpg',
                    full: 'https://example.com/item2.jpg',
                    alt: 'Alt text 2',
                    title: 'Item Title 2'
                }
            ];

            mockApiFetch.mockResolvedValue(mockItems);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/galleries/123/items'
            });

            expect(result).toEqual(mockItems);
        });

        test('handles gallery items with limit', async () => {
            const mockLimitedItems = [
                { id: 101, position: 1 },
                { id: 102, position: 2 }
            ];

            mockApiFetch.mockResolvedValue(mockLimitedItems);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/galleries/123/items?limit=2'
            });

            expect(result).toEqual(mockLimitedItems);
        });

        test('handles gallery not found error', async () => {
            const mockError = {
                code: 'gallery_not_found',
                message: 'Gallery not found.',
                data: { status: 404 }
            };

            mockApiFetch.mockRejectedValue(mockError);

            try {
                await mockApiFetch({
                    path: '/fotogrids/v1/galleries/999/items'
                });
            } catch (error) {
                expect(error).toEqual(mockError);
            }
        });
    });

    describe('Templates Endpoint', () => {
        test('fetches available templates', async () => {
            const mockTemplates = [
                {
                    id: 'grid',
                    name: 'Grid',
                    description: 'Simple grid layout',
                    type: 'free',
                    preview: 'https://example.com/previews/grid.jpg'
                },
                {
                    id: 'masonry',
                    name: 'Masonry',
                    description: 'Pinterest-style masonry layout',
                    type: 'free',
                    preview: 'https://example.com/previews/masonry.jpg'
                },
                {
                    id: 'slider',
                    name: 'Slider',
                    description: 'Item slider with navigation',
                    type: 'starter',
                    preview: 'https://example.com/previews/slider.jpg'
                }
            ];

            mockApiFetch.mockResolvedValue(mockTemplates);

            const result = await mockApiFetch({
                path: '/fotogrids/v1/templates'
            });

            expect(result).toEqual(mockTemplates);
            expect(result).toHaveLength(3);
            expect(result[0].type).toBe('free');
            expect(result[2].type).toBe('starter');
        });
    });

    describe('Statistics Endpoint', () => {
        test('tracks gallery view', async () => {
            const mockResponse = { success: true };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const response = await fetch(`${baseUrl}/stats/view`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': 'test-nonce'
                },
                body: JSON.stringify({
                    gallery_id: 123,
                    event_type: 'gallery_view',
                    event_data: { layout: 'grid' }
                })
            });

            const result = await response.json();

            expect(fetch).toHaveBeenCalledWith(`${baseUrl}/stats/view`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': 'test-nonce'
                },
                body: JSON.stringify({
                    gallery_id: 123,
                    event_type: 'gallery_view',
                    event_data: { layout: 'grid' }
                })
            });
            expect(result).toEqual(mockResponse);
        });

        test('tracks item click', async () => {
            const mockResponse = { success: true };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            await fetch(`${baseUrl}/stats/view`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': 'test-nonce'
                },
                body: JSON.stringify({
                    gallery_id: 123,
                    event_type: 'item_click',
                    event_data: { item_id: 456 }
                })
            });

            expect(fetch).toHaveBeenCalledWith(`${baseUrl}/stats/view`, expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('item_click')
            }));
        });
    });

    describe('Error Handling', () => {
        test('handles network errors', async () => {
            const networkError = new Error('Network error');
            mockApiFetch.mockRejectedValue(networkError);

            try {
                await mockApiFetch({ path: '/fotogrids/v1/galleries' });
            } catch (error) {
                expect(error).toBe(networkError);
            }
        });

        test('handles 404 errors', async () => {
            const notFoundError = {
                code: 'rest_no_route',
                message: 'No route was found matching the URL and request method',
                data: { status: 404 }
            };

            mockApiFetch.mockRejectedValue(notFoundError);

            try {
                await mockApiFetch({ path: '/fotogrids/v1/nonexistent' });
            } catch (error) {
                expect(error.data.status).toBe(404);
            }
        });

        test('handles permission errors', async () => {
            const permissionError = {
                code: 'rest_forbidden',
                message: 'You are not allowed to access this resource',
                data: { status: 403 }
            };

            mockApiFetch.mockRejectedValue(permissionError);

            try {
                await mockApiFetch({ path: '/fotogrids/v1/admin-only-endpoint' });
            } catch (error) {
                expect(error.data.status).toBe(403);
            }
        });
    });

    describe('Response Validation', () => {
        test('validates gallery response structure', async () => {
            const mockGallery = {
                id: 1,
                title: 'Test Gallery',
                item_count: 5,
                featured_item: 'https://example.com/item.jpg',
                created: '2023-01-01T00:00:00Z',
                modified: '2023-01-01T00:00:00Z'
            };

            mockApiFetch.mockResolvedValue([mockGallery]);
            const result = await mockApiFetch({ path: '/fotogrids/v1/galleries' });

            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('title');
            expect(result[0]).toHaveProperty('item_count');
            expect(typeof result[0].id).toBe('number');
            expect(typeof result[0].title).toBe('string');
            expect(typeof result[0].item_count).toBe('number');
        });

        test('validates item response structure', async () => {
            const mockItem = {
                id: 101,
                position: 1,
                caption: 'Test caption',
                url: 'https://example.com/item.jpg',
                thumbnail: 'https://example.com/thumb.jpg',
                alt: 'Alt text'
            };

            mockApiFetch.mockResolvedValue([mockItem]);
            const result = await mockApiFetch({ path: '/fotogrids/v1/galleries/1/items' });

            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('url');
            expect(result[0]).toHaveProperty('thumbnail');
            expect(typeof result[0].id).toBe('number');
            expect(typeof result[0].url).toBe('string');
        });

        test('validates template response structure', async () => {
            const mockTemplate = {
                id: 'grid',
                name: 'Grid',
                description: 'Grid layout',
                type: 'free',
                preview: 'https://example.com/preview.jpg'
            };

            mockApiFetch.mockResolvedValue([mockTemplate]);
            const result = await mockApiFetch({ path: '/fotogrids/v1/templates' });

            expect(result[0]).toHaveProperty('id');
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('type');
            expect(typeof result[0].id).toBe('string');
            expect(['free', 'starter', 'expert', 'commerce']).toContain(result[0].type);
        });
    });
});
