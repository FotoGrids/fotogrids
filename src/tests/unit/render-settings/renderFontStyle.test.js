/**
 * Tests for renderFontStyle.js (wraps renderSelect)
 */
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderFontStyle';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderFontStyle(setting, value, disabled, {
		updateSetting: jest.fn(),
		getFieldState: undefined,
		renderIcon,
		__,
		...deps,
	});

const selectedText = (container) =>
	container.querySelector('.fotogrids-render-select__selected').textContent;

describe('renderFontStyle', () => {
	it('falls back to the default_option_value when no value is set', () => {
		// default_option_value defaults to "default" -> "Theme Default".
		const { container } = renderElement(
			build({ key: 'style', label: 'Style' }, '', false)
		);
		expect(selectedText(container)).toBe('Theme Default');
	});

	it('shows the matching named style for a known value', () => {
		const { container } = renderElement(
			build({ key: 'style' }, 'italic', false)
		);
		expect(selectedText(container)).toBe('Italic');
	});

	it('shows Normal for the normal value', () => {
		const { container } = renderElement(
			build({ key: 'style' }, 'normal', false)
		);
		expect(selectedText(container)).toBe('Normal');
	});

	it('falls back to the raw value for an unknown style', () => {
		const { container } = renderElement(
			build({ key: 'style' }, 'oblique', false)
		);
		expect(selectedText(container)).toBe('oblique');
	});

	it('honours a custom default_option_value when value is empty', () => {
		const { container } = renderElement(
			build(
				{ key: 'style', default_option_value: 'normal' },
				'',
				false
			)
		);
		expect(selectedText(container)).toBe('Normal');
	});

	it('updates the setting when an option is chosen', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'style' }, 'normal', false, { updateSetting })
		);
		click(container.querySelector('.fotogrids-render-select__trigger'));
		const italic = [
			...document.querySelectorAll('.fotogrids-render-select__option'),
		].find((b) => b.textContent === 'Italic');
		click(italic);
		expect(updateSetting).toHaveBeenCalledWith('style', 'italic');
	});
});
