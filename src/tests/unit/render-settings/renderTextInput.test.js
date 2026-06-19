/**
 * Tests for renderTextInput.js
 */
import '@/admin/plain/render-settings/renderTextInput';
import { renderElement, changeValue } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderTextInput(setting, value, disabled, {
		updateSetting: jest.fn(),
		__,
		...deps,
	});

describe('renderTextInput', () => {
	it('renders a text input with the current value', () => {
		const { container } = renderElement(
			build({ key: 'k', label: 'Name', placeholder: 'p' }, 'hi', false)
		);
		const input = container.querySelector('input.fotogrids-input');
		expect(input.value).toBe('hi');
		expect(input.placeholder).toBe('p');
		expect(container.textContent).toContain('Name');
	});

	it('falls back to setting.default when value is empty', () => {
		const { container } = renderElement(
			build({ key: 'k', default: 'def' }, '', false)
		);
		expect(container.querySelector('input').value).toBe('def');
	});

	it('renders a textarea in multiline mode', () => {
		const { container } = renderElement(
			build({ key: 'k', multiline: true, rows: 5 }, 'x', false)
		);
		const ta = container.querySelector('textarea');
		expect(ta).not.toBeNull();
		expect(ta.rows).toBe(5);
	});

	it('calls updateSetting on change when enabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'k' }, '', false, { updateSetting })
		);
		changeValue(container.querySelector('input'), 'typed');
		expect(updateSetting).toHaveBeenCalledWith('k', 'typed');
	});

	it('does not call updateSetting when disabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'k' }, '', true, { updateSetting })
		);
		const input = container.querySelector('input');
		expect(input.disabled).toBe(true);
		changeValue(input, 'typed');
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('shows a Locked/Pro badge from field state', () => {
		const locked = renderElement(
			build({ key: 'k', label: 'L' }, '', false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			locked.container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');

		const pro = renderElement(
			build({ key: 'k', label: 'L' }, '', false, {
				getFieldState: () => 'teaser',
			})
		);
		expect(
			pro.container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Pro');
	});

	it('renders an optional description', () => {
		const { container } = renderElement(
			build({ key: 'k', description: 'help text' }, '', false)
		);
		expect(
			container.querySelector('.fotogrids-setting__description').textContent
		).toBe('help text');
	});
});
