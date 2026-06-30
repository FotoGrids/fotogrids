/**
 * Tests for renderFontWeight.js (wraps renderSelect)
 */
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderFontWeight';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderFontWeight(setting, value, disabled, {
		updateSetting: jest.fn(),
		getFieldState: undefined,
		renderIcon,
		__,
		...deps,
	});

describe('renderFontWeight', () => {
	it('shows Default when no value is set', () => {
		const { container } = renderElement(
			build({ key: 'weight', label: 'Weight' }, '', false)
		);
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toBe('Default');
	});

	it('shows the matching named weight for a known value', () => {
		const { container } = renderElement(
			build({ key: 'weight' }, '700', false)
		);
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toBe('Bold (700)');
	});

	it('falls back to the raw value for an unknown weight', () => {
		const { container } = renderElement(
			build({ key: 'weight' }, '650', false)
		);
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toBe('650');
	});

	it('honours a custom default_option_value', () => {
		const { container } = renderElement(
			build({ key: 'weight', default_option_value: 'inherit' }, '', false)
		);
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toBe('Default');
	});

	it('updates the setting when an option is chosen', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'weight' }, '400', false, { updateSetting })
		);
		click(container.querySelector('.fotogrids-render-select__trigger'));
		const bold = [
			...document.querySelectorAll('.fotogrids-render-select__option'),
		].find((b) => b.textContent === 'Bold (700)');
		click(bold);
		expect(updateSetting).toHaveBeenCalledWith('weight', '700');
	});
});
