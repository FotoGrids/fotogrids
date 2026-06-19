/**
 * Tests for renderWatermarkStatus.js
 */
import '@/admin/plain/render-settings/renderWatermarkStatus';
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
	window.FotoGridsRenderSettings.renderWatermarkStatus(
		{ key: 'wm', label: 'Watermark' },
		null,
		false,
		{
			__,
			postId: 9,
			restUrl: 'https://x/wp-json/fotogrids/v1/',
			restNonce: 'n',
			...deps,
		}
	);

const okJson = (data) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

const PENDING = {
	enabled: true,
	pending: 2,
	pending_ids: [11, 12],
	counts: { total: 5 },
	items: [
		{ attachment_id: 11, state: 'missing', title: 'A' },
		{ attachment_id: 12, state: 'stale', title: 'B' },
		{ attachment_id: 13, state: 'current', title: 'C' },
	],
};

describe('renderWatermarkStatus', () => {
	afterEach(() => {
		delete window.fotogridsToast;
	});

	it('renders nothing while loading', () => {
		global.fetch = jest.fn(() => new Promise(() => {}));
		const { container } = renderElement(build());
		expect(container.textContent).toBe('');
	});

	it('renders nothing when watermarking is disabled', async () => {
		global.fetch = jest.fn(() => okJson({ enabled: false, pending: 0 }));
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toBe('');
	});

	it('renders nothing when there are no pending items', async () => {
		global.fetch = jest.fn(() => okJson({ enabled: true, pending: 0 }));
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toBe('');
	});

	it('surfaces a pending notice with a regenerate button', async () => {
		global.fetch = jest.fn(() => okJson(PENDING));
		const handle = renderElement(build());
		await flush();
		expect(handle.container.textContent).toContain('aren’t watermarked');
		expect(handle.container.querySelector('button')).not.toBeNull();
	});

	it('toggles the missing-items list', async () => {
		global.fetch = jest.fn(() => okJson(PENDING));
		const handle = renderElement(build());
		await flush();
		const toggle = [
			...handle.container.querySelectorAll('button'),
		].find((b) => /Show missing items/.test(b.textContent));
		click(toggle);
		expect(
			handle.container.querySelector(
				'.fotogrids-settings_watermark-status__list'
			)
		).not.toBeNull();
	});

	it('regenerates pending images and shows a success toast', async () => {
		const success = jest.fn();
		window.fotogridsToast = { success, error: jest.fn() };
		global.fetch = jest
			.fn()
			.mockImplementationOnce(() => okJson(PENDING)) // initial status
			.mockImplementation(() =>
				okJson({ enabled: true, pending: 0 })
			); // regenerate POSTs + refetch

		const handle = renderElement(build());
		await flush();
		const regenBtn = [
			...handle.container.querySelectorAll('button'),
		].find((b) => !/Show missing/.test(b.textContent));
		await act(async () => {
			click(regenBtn);
			for (let i = 0; i < 6; i++) await Promise.resolve();
		});
		await flush();
		expect(success).toHaveBeenCalled();
	});
});
