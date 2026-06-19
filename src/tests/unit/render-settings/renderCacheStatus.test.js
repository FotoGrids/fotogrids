/**
 * Tests for renderCacheStatus.js
 */
import '@/admin/plain/render-settings/renderCacheStatus';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const build = (deps = {}) =>
	window.FotoGridsRenderSettings.renderCacheStatus(
		{ key: 'cache', label: 'Cache' },
		null,
		false,
		{
			__,
			postId: 5,
			restUrl: 'https://x/wp-json/fotogrids/v1/',
			restNonce: 'n',
			...deps,
		}
	);

const okJson = (data) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

describe('renderCacheStatus', () => {
	afterEach(() => {
		delete window.fotogridsToast;
	});

	it('shows a loading state initially', () => {
		global.fetch = jest.fn(() => new Promise(() => {}));
		const { container } = renderElement(build());
		expect(container.textContent).toContain('Loading cache status…');
	});

	it('shows the empty state when nothing is cached', async () => {
		global.fetch = jest.fn(() => okJson({ cached: false }));
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toContain(
			'No cache exists for this gallery yet'
		);
	});

	it('renders cached metadata and a Clear Cache button', async () => {
		global.fetch = jest.fn(() =>
			okJson({
				cached: true,
				meta: {
					cached_at: '2026-01-01T00:00:00Z',
					expires_at: '2026-02-01T00:00:00Z',
				},
			})
		);
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toContain('Cached at');
		expect(handle.container.textContent).toContain('Expires at');
		expect(
			[...handle.container.querySelectorAll('button')].some(
				(b) => b.textContent === 'Clear Cache'
			)
		).toBe(true);
	});

	it('shows an error state when the request fails', async () => {
		global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toContain(
			'Could not load cache status'
		);
	});

	it('clears the cache and shows a success toast', async () => {
		const success = jest.fn();
		window.fotogridsToast = { success, error: jest.fn() };
		const cached = {
			cached: true,
			meta: { cached_at: 'x', expires_at: 'y' },
		};
		global.fetch = jest
			.fn()
			.mockImplementationOnce(() => okJson(cached)) // initial GET
			.mockImplementationOnce(() => Promise.resolve({ ok: true })) // DELETE
			.mockImplementationOnce(() => okJson({ cached: false })); // refetch

		const handle = renderElement(build());
		await flush();
		const clearBtn = [
			...handle.container.querySelectorAll('button'),
		].find((b) => b.textContent === 'Clear Cache');
		await act(async () => {
			click(clearBtn);
			await Promise.resolve();
			await Promise.resolve();
		});
		await flush();
		expect(success).toHaveBeenCalled();
	});
});
