/**
 * Tests for renderImagePicker.js
 */
import '@/admin/plain/render-settings/renderImagePicker';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderImagePicker(setting, value, disabled, {
		updateSetting: jest.fn(),
		__,
		...deps,
	});

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe('renderImagePicker', () => {
	beforeEach(() => {
		global.wp.apiFetch.mockReset();
	});

	afterEach(() => {
		delete window.wp?.media;
	});

	it('renders a Choose button when nothing is selected', () => {
		const { container } = renderElement(
			build({ key: 'img', label: 'OG image' }, 0, false)
		);
		expect(container.textContent).toContain('Choose image');
		expect(container.querySelector('img')).toBeNull();
	});

	it('uses a custom buttonLabel', () => {
		const { container } = renderElement(
			build({ key: 'img', buttonLabel: 'Pick one' }, 0, false)
		);
		expect(container.textContent).toContain('Pick one');
	});

	it('fetches and shows a preview for a selected attachment', async () => {
		global.wp.apiFetch.mockResolvedValue({
			media_details: {
				sizes: { medium: { source_url: 'http://x/med.jpg' } },
			},
		});
		const handle = renderElement(build({ key: 'img' }, 42, false));
		await flush();
		const img = handle.container.querySelector('img');
		expect(img.src).toBe('http://x/med.jpg');
		expect(handle.container.textContent).toContain('Replace image');
		expect(handle.container.textContent).toContain('Remove');
	});

	it('clears the selection when Remove is clicked', async () => {
		global.wp.apiFetch.mockResolvedValue({ source_url: 'http://x/f.jpg' });
		const updateSetting = jest.fn();
		const handle = renderElement(
			build({ key: 'img' }, 7, false, { updateSetting })
		);
		await flush();
		const removeBtn = [
			...handle.container.querySelectorAll('button'),
		].find((b) => b.textContent === 'Remove');
		click(removeBtn);
		expect(updateSetting).toHaveBeenCalledWith('img', 0);
	});

	it('opens wp.media and stores the chosen id on select', () => {
		const selection = { id: 99 };
		const frame = {
			on: jest.fn((evt, cb) => {
				frame._selectCb = cb;
			}),
			open: jest.fn(),
			state: () => ({
				get: () => ({ first: () => selection }),
			}),
		};
		const mediaFactory = jest.fn(() => frame);
		window.wp.media = mediaFactory;
		const updateSetting = jest.fn();

		const { container } = renderElement(
			build({ key: 'img' }, 0, false, { updateSetting })
		);
		click(container.querySelector('button.fg-button'));
		expect(mediaFactory).toHaveBeenCalled();
		expect(frame.open).toHaveBeenCalled();

		frame._selectCb(); // simulate the 'select' event
		expect(updateSetting).toHaveBeenCalledWith('img', 99);
	});

	it('shows a Locked badge from field state', () => {
		const { container } = renderElement(
			build({ key: 'img', label: 'L' }, 0, false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
