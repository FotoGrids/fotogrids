/**
 * Tests for renderFontFamily.js (wraps renderSelect; lazy-loads Google fonts)
 */
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderFontFamily';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;
const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const build = (value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderFontFamily(
		{ key: 'font', label: 'Font' },
		value,
		disabled,
		{ updateSetting: jest.fn(), getFieldState: undefined, renderIcon, __, ...deps }
	);

describe('renderFontFamily', () => {
	let mounted = [];
	const mount = (el) => {
		const h = renderElement(el);
		mounted.push(h);
		return h;
	};

	beforeEach(() => {
		delete window.FotoGridsFontFamilyCache;
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({ fonts: ['Roboto', 'Lato'] }),
			})
		);
	});

	afterEach(() => {
		mounted.forEach((h) => h.unmount());
		mounted = [];
	});

	it('shows the Default option when no value is set', () => {
		const { container } = mount(build('', false));
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toMatch(/Default/);
	});

	it('shows the selected system font label', () => {
		const { container } = mount(build('Georgia', false));
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toContain('Georgia');
	});

	it('opens the dropdown and lists system fonts', async () => {
		const { container } = mount(build('', false));
		await act(async () => {
			click(
				container.querySelector('.fotogrids-render-select__trigger')
			);
			await Promise.resolve();
		});
		await flush();
		const text = document.body.textContent;
		expect(text).toContain('Arial');
		expect(text).toContain('Georgia');
	});

	it('updates the setting when a font option is chosen', async () => {
		const updateSetting = jest.fn();
		const { container } = mount(build('', false, { updateSetting }));
		await act(async () => {
			click(
				container.querySelector('.fotogrids-render-select__trigger')
			);
			await Promise.resolve();
		});
		await flush();
		const georgia = [
			...document.querySelectorAll('.fotogrids-render-select__option'),
		].find((b) => b.textContent.includes('Georgia'));
		click(georgia);
		expect(updateSetting).toHaveBeenCalledWith('font', 'Georgia');
	});
});
