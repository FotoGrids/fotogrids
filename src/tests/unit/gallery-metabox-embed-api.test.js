/**
 * Tests for components/gallery-metabox/api/embed-api.js
 *
 * The three endpoints differ in how they report failure: create and update
 * toast and throw, delete toast and swallows. Each path is driven here with a
 * stubbed fetch.
 */
import {
	toCanonicalSource,
	createEmbed,
	updateEmbed,
	deleteEmbed,
} from '@/admin/src/components/gallery-metabox/api/embed-api';

const okResponse = (body) => ({ ok: true, json: () => Promise.resolve(body) });
const errResponse = (status, body) => ({
	ok: false,
	status,
	json: () => Promise.resolve(body),
});

const lastRequest = () => global.fetch.mock.calls.at(-1);

describe('toCanonicalSource', () => {
	it('maps vimeo to its item_type', () => {
		expect(toCanonicalSource('vimeo')).toBe('video_vimeo');
	});

	it('treats anything else as youtube', () => {
		expect(toCanonicalSource('youtube')).toBe('video_youtube');
		expect(toCanonicalSource(undefined)).toBe('video_youtube');
	});
});

describe('embed-api', () => {
	beforeEach(() => {
		global.fetch.mockReset();
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		window.wpApiSettings = {
			root: 'https://example.com/wp-json/',
			nonce: 'test-nonce',
		};
	});

	describe('createEmbed', () => {
		it('posts the canonical source and the gallery id', async () => {
			global.fetch.mockResolvedValue(okResponse({ id: 9 }));

			const data = await createEmbed({
				embedForm: { source: 'vimeo', url: 'https://vimeo.com/1' },
				galleryId: 42,
			});

			expect(data).toEqual({ id: 9 });
			const [url, init] = lastRequest();
			expect(url).toBe('https://example.com/wp-json/fotogrids/v1/items/embed');
			expect(init.method).toBe('POST');
			expect(init.headers['X-WP-Nonce']).toBe('test-nonce');
			expect(JSON.parse(init.body)).toMatchObject({
				gallery_id: 42,
				source: 'video_vimeo',
			});
		});

		it('toasts the server message and throws', async () => {
			global.fetch.mockResolvedValue(errResponse(400, { message: 'Bad embed' }));

			await expect(
				createEmbed({ embedForm: { source: 'youtube' }, galleryId: 1 })
			).rejects.toThrow('Bad embed');
			expect(window.fotogridsToast.error).toHaveBeenCalledWith('Bad embed');
		});

		it('falls back to the status code when the body carries no message', async () => {
			global.fetch.mockResolvedValue(errResponse(500, {}));

			await expect(
				createEmbed({ embedForm: { source: 'youtube' }, galleryId: 1 })
			).rejects.toThrow('HTTP 500');
		});

		it('still throws when no toast host is present', async () => {
			delete window.fotogridsToast;
			global.fetch.mockResolvedValue(errResponse(403, { message: 'Nope' }));

			await expect(
				createEmbed({ embedForm: { source: 'youtube' }, galleryId: 1 })
			).rejects.toThrow('Nope');
		});
	});

	describe('updateEmbed', () => {
		it('puts to the embed id', async () => {
			global.fetch.mockResolvedValue(okResponse({ id: 7, caption: 'x' }));

			const data = await updateEmbed({
				embedForm: { id: 7, source: 'youtube' },
			});

			expect(data).toEqual({ id: 7, caption: 'x' });
			const [url, init] = lastRequest();
			expect(url).toBe('https://example.com/wp-json/fotogrids/v1/items/embed/7');
			expect(init.method).toBe('PUT');
			expect(JSON.parse(init.body).source).toBe('video_youtube');
		});

		it('toasts and throws on failure', async () => {
			global.fetch.mockResolvedValue(errResponse(404, { message: 'Gone' }));

			await expect(
				updateEmbed({ embedForm: { id: 7, source: 'vimeo' } })
			).rejects.toThrow('Gone');
			expect(window.fotogridsToast.error).toHaveBeenCalledWith('Gone');
		});
	});

	describe('deleteEmbed', () => {
		it('deletes by id', async () => {
			global.fetch.mockResolvedValue(okResponse({}));

			await deleteEmbed({ embedId: 3, strings: {} });

			const [url, init] = lastRequest();
			expect(url).toBe('https://example.com/wp-json/fotogrids/v1/items/embed/3');
			expect(init.method).toBe('DELETE');
			expect(window.fotogridsToast.error).not.toHaveBeenCalled();
		});

		it('reports a failed response without throwing', async () => {
			global.fetch.mockResolvedValue(errResponse(500, {}));

			await expect(
				deleteEmbed({ embedId: 3, strings: { videoEmbedRemoveFailed: 'Nope' } })
			).resolves.toBeUndefined();
			expect(window.fotogridsToast.error).toHaveBeenCalledWith('Nope');
		});

		it('falls back to a built-in message when the string is absent', async () => {
			global.fetch.mockRejectedValue(new Error('offline'));

			await deleteEmbed({ embedId: 3, strings: {} });

			expect(window.fotogridsToast.error).toHaveBeenCalledWith(
				'Failed to remove the video.'
			);
		});

		it('swallows the failure when no toast host is present', async () => {
			delete window.fotogridsToast;
			global.fetch.mockRejectedValue(new Error('offline'));

			await expect(
				deleteEmbed({ embedId: 3, strings: {} })
			).resolves.toBeUndefined();
		});
	});

	describe('rest config fallbacks', () => {
		it('uses the site-relative root when wpApiSettings is absent', async () => {
			delete window.wpApiSettings;
			global.fetch.mockResolvedValue(okResponse({}));

			await deleteEmbed({ embedId: 1, strings: {} });

			const [url, init] = lastRequest();
			expect(url).toBe('/wp-json/fotogrids/v1/items/embed/1');
			expect(init.headers['X-WP-Nonce']).toBe('');
		});
	});
});
