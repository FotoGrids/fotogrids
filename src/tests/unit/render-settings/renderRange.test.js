/**
 * Tests for renderRange.js
 */
import '@/admin/plain/render-settings/renderRange';
import { renderElement, changeValue } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderRange(setting, value, disabled, {
		updateSetting: jest.fn(),
		__,
		...deps,
	});

const setRange = (input, value) => changeValue(input, String(value));

describe('renderRange', () => {
	it('renders a slider + number input with the current value', () => {
		const { container } = renderElement(
			build({ key: 'cols', label: 'Columns', min: 1, max: 6 }, 4, false)
		);
		const slider = container.querySelector('input[type="range"]');
		const number = container.querySelector('input[type="number"]');
		expect(slider.value).toBe('4');
		expect(number.value).toBe('4');
		expect(container.textContent).toContain('Columns');
	});

	it('uses setting.default when value is null/undefined', () => {
		const { container } = renderElement(
			build({ key: 'k', min: 0, max: 10, default: 7 }, null, false)
		);
		expect(container.querySelector('input[type="range"]').value).toBe('7');
	});

	it('updates the value from the slider when enabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'cols', min: 1, max: 6 }, 2, false, { updateSetting })
		);
		setRange(container.querySelector('input[type="range"]'), 5);
		expect(updateSetting).toHaveBeenCalledWith('cols', 5);
	});

	it('does not update when disabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'cols', min: 1, max: 6 }, 2, true, { updateSetting })
		);
		setRange(container.querySelector('input[type="range"]'), 5);
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('coerces a non-numeric number-field entry to the default', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'cols', min: 1, max: 6, default: 3 }, 2, false, {
				updateSetting,
			})
		);
		changeValue(container.querySelector('input[type="number"]'), '');
		expect(updateSetting).toHaveBeenCalledWith('cols', 3);
	});

	it('handles unit-bearing values and emits {value, unit}', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				{ key: 'gap', min: 0, max: 50, units: ['px', 'em'] },
				{ value: 10, unit: 'px' },
				false,
				{ updateSetting }
			)
		);
		expect(container.querySelector('input[type="range"]').value).toBe('10');
		setRange(container.querySelector('input[type="range"]'), 20);
		expect(updateSetting).toHaveBeenCalledWith('gap', {
			value: 20,
			unit: 'px',
		});
	});

	it('changes the unit via the units select', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				{ key: 'gap', min: 0, max: 50, units: ['px', 'em'] },
				{ value: 10, unit: 'px' },
				false,
				{ updateSetting }
			)
		);
		changeValue(
			container.querySelector('select.fotogrids-units-select'),
			'em'
		);
		expect(updateSetting).toHaveBeenCalledWith('gap', {
			value: 10,
			unit: 'em',
		});
	});

	it('shows a pro badge from field state', () => {
		const { container } = renderElement(
			build({ key: 'k', label: 'L', min: 0, max: 5 }, 1, false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
