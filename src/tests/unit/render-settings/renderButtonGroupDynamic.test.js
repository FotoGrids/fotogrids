/**
 * Tests for renderButtonGroupDynamic.js (+ renderImageSize which wraps it)
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderButtonGroupDynamic';
import '@/admin/plain/render-settings/renderImageSize';
import { renderElement, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

// Flush the fetch microtasks + the resulting setState inside act().
const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const build = (setting, value, deps = {}) =>
	window.FotoGridsRenderSettings.renderButtonGroupDynamic(
		setting,
		value,
		false,
		{ updateSetting: jest.fn(), renderIcon, __, ...deps }
	);

describe('renderButtonGroupDynamic', () => {
	afterEach(() => {
		global.fetch.mockReset?.();
	});

	it('shows a loading state before options resolve', () => {
		global.fetch = jest.fn(() => new Promise(() => {})); // never resolves
		const { container } = renderElement(
			build(
				{ key: 'size', label: 'Size', api_endpoint: '/sizes', options_key: 'sizes' },
				'full'
			)
		);
		expect(container.querySelector('.fotogrids-loading')).not.toBeNull();
		expect(container.textContent).toContain('Loading options…');
	});

	it('renders fetched options once resolved', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						sizes: [
							{ value: 'thumb', label: 'Thumb', width: 150, height: 150 },
							{ value: 'full', label: 'Full' },
						],
					}),
			})
		);
		const handle = renderElement(
			build(
				{ key: 'size', api_endpoint: '/sizes', options_key: 'sizes' },
				'full'
			)
		);
		await flush();
		const buttons = handle.container.querySelectorAll(
			'.fg-button-group__button'
		);
		expect(buttons.length).toBe(2);
	});

	it('falls back to fallback_options when the request is not ok', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
		const handle = renderElement(
			build(
				{
					key: 'size',
					api_endpoint: '/sizes',
					options_key: 'sizes',
					fallback_options: [{ value: 'full', label: 'Full' }],
				},
				'full'
			)
		);
		await flush();
		expect(
			handle.container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(1);
		warn.mockRestore();
	});

	it('falls back when fetch throws', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.reject(new Error('network')));
		const handle = renderElement(
			build(
				{
					key: 'size',
					api_endpoint: '/sizes',
					options_key: 'sizes',
					fallback_options: [
						{ value: 'a', label: 'A' },
						{ value: 'b', label: 'B' },
					],
				},
				'a'
			)
		);
		await flush();
		expect(
			handle.container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(2);
		warn.mockRestore();
	});
});

describe('renderImageSize (wraps dynamic group)', () => {
	it('renders additional size info for the selected option', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						sizes: [
							{
								value: 'thumb',
								label: 'Thumb',
								width: 150,
								height: 150,
								crop: true,
							},
						],
					}),
			})
		);
		const handle = renderElement(
			window.FotoGridsRenderSettings.renderImageSize(
				{ key: 'size', api_endpoint: '/s', options_key: 'sizes' },
				'thumb',
				false,
				{ updateSetting: jest.fn(), renderIcon, __ }
			)
		);
		await flush();
		expect(handle.container.textContent).toContain('150x150');
	});
});
