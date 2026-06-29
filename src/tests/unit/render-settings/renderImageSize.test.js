/**
 * Tests for renderImageSize.js - focuses on the renderAdditionalContent
 * branches (full/Original, no-size, crop) not exercised elsewhere.
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderButtonGroupDynamic';
import '@/admin/plain/render-settings/renderImageSize';
import { renderElement, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const buildWith = (sizes, value) => {
	global.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ sizes }),
		})
	);
	return renderElement(
		window.FotoGridsRenderSettings.renderImageSize(
			{ key: 'size', api_endpoint: '/s', options_key: 'sizes' },
			value,
			false,
			{ updateSetting: jest.fn(), renderIcon, __ }
		)
	);
};

describe('renderImageSize additional content', () => {
	afterEach(() => {
		global.fetch.mockReset?.();
	});

	it('shows "Original" for the full size option', async () => {
		const handle = buildWith(
			[{ value: 'full', label: 'Full' }],
			'full'
		);
		await flush();
		expect(handle.container.textContent).toContain('Image Size:');
		expect(handle.container.textContent).toContain('Original');
	});

	it('renders Crop: Yes when crop is true', async () => {
		const handle = buildWith(
			[
				{
					value: 'thumb',
					label: 'Thumb',
					width: 150,
					height: 150,
					crop: true,
				},
			],
			'thumb'
		);
		await flush();
		expect(handle.container.textContent).toContain('150x150');
		expect(handle.container.textContent).toContain('Crop:');
		expect(handle.container.textContent).toContain('Yes');
	});

	it('renders Crop: No when crop is false', async () => {
		const handle = buildWith(
			[
				{
					value: 'medium',
					label: 'Medium',
					width: 300,
					height: 300,
					crop: false,
				},
			],
			'medium'
		);
		await flush();
		expect(handle.container.textContent).toContain('Crop:');
		expect(handle.container.textContent).toContain('No');
	});

	it('renders no size info for the custom option', async () => {
		const handle = buildWith(
			[{ value: 'custom', label: 'Custom' }],
			'custom'
		);
		await flush();
		expect(handle.container.textContent).not.toContain('Image Size:');
	});

	it('renders no size info for a sizeless, non-full option', async () => {
		const handle = buildWith(
			[{ value: 'weird', label: 'Weird' }],
			'weird'
		);
		await flush();
		expect(handle.container.textContent).not.toContain('Image Size:');
	});
});
