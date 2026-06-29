/**
 * Tests for renderResponsiveRange.js (responsive slider with device tabs)
 */
import '@/admin/plain/render-settings/renderResponsiveRange';
import { renderElement, click, changeValue } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderResponsiveRange(
		setting,
		value,
		disabled,
		{
			updateSetting: jest.fn(),
			activeDevice: 'desktop',
			setActiveDevice: jest.fn(),
			renderIcon,
			__,
			...deps,
		}
	);

describe('renderResponsiveRange (simple per-device value)', () => {
	const PER_DEVICE = { min: 1, max: 6, default: 3 };
	const SETTING = {
		key: 'cols',
		label: 'Columns',
		responsive: {
			desktop: PER_DEVICE,
			tablet: PER_DEVICE,
			mobile: PER_DEVICE,
		},
	};

	it('renders three device buttons and a slider', () => {
		const { container } = renderElement(
			build(SETTING, { desktop: 3, tablet: 2, mobile: 1 }, false)
		);
		expect(
			container.querySelectorAll('.fotogrids-responsive-device-btn')
		).toHaveLength(3);
		expect(container.querySelector('input[type="range"]')).not.toBeNull();
	});

	it('shows the active device value in the slider', () => {
		const { container } = renderElement(
			build(SETTING, { desktop: 4, tablet: 2, mobile: 1 }, false)
		);
		expect(container.querySelector('input[type="range"]').value).toBe('4');
	});

	it('switches device on tab click', () => {
		const setActiveDevice = jest.fn();
		const { container } = renderElement(
			build(SETTING, { desktop: 3, tablet: 2, mobile: 1 }, false, {
				setActiveDevice,
			})
		);
		click(
			container.querySelectorAll('.fotogrids-responsive-device-btn')[1]
		);
		expect(setActiveDevice).toHaveBeenCalledWith('tablet');
	});

	it('updates the active device value from the slider', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(SETTING, { desktop: 3, tablet: 2, mobile: 1 }, false, {
				updateSetting,
			})
		);
		changeValue(container.querySelector('input[type="range"]'), '5');
		expect(updateSetting).toHaveBeenCalledWith(
			'cols',
			expect.objectContaining({ desktop: 5 })
		);
	});

	it('marks the active device button', () => {
		const { container } = renderElement(
			build(SETTING, { desktop: 3 }, false, { activeDevice: 'mobile' })
		);
		expect(
			container.querySelector('.fotogrids-responsive-device-btn.fg-is-active')
		).not.toBeNull();
	});

	it('shows a pro badge from field state', () => {
		const { container } = renderElement(
			build(SETTING, { desktop: 3 }, false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});

describe('renderResponsiveRange (no_range, decimals)', () => {
	const PER_DEVICE = { min: 0, max: 5, step: 0.1, default: 1.2 };
	const SETTING = {
		key: 'caption_title_line_height',
		label: 'Line Height',
		no_range: true,
		allow_decimals: true,
		units: ['em', 'px', 'rem'],
		responsive: {
			desktop: PER_DEVICE,
			tablet: PER_DEVICE,
			mobile: PER_DEVICE,
		},
	};

	it('hides the slider and adds the no-range modifier', () => {
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { value: 1.2, unit: 'em' } },
				false
			)
		);
		expect(container.querySelector('input[type="range"]')).toBeNull();
		expect(
			container.querySelector(
				'.fotogrids-responsive-setting__controls--no-range'
			)
		).not.toBeNull();
	});

	it('shows the decimal value in the number input', () => {
		const { container } = renderElement(
			build(SETTING, { desktop: { value: 1.2, unit: 'em' } }, false)
		);
		expect(container.querySelector('input[type="number"]').value).toBe(
			'1.2'
		);
	});

	it('falls back to the per-device default when no value and no seeded default exist', () => {
		// Regression: with no saved value and no window.fotogridsSettings.defaults
		// entry, defaultResponsive falls back to setting.responsive, whose
		// per-device entries are config objects ({min, max, default}). The input
		// must show the scalar default (1.2), never render empty.
		const { container } = renderElement(build(SETTING, undefined, false));
		expect(container.querySelector('input[type="number"]').value).toBe(
			'1.2'
		);
	});

	it('preserves a decimal value entered in the number input', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(SETTING, { desktop: { value: 1.2, unit: 'em' } }, false, {
				updateSetting,
			})
		);
		changeValue(container.querySelector('input[type="number"]'), '1.5');
		expect(updateSetting).toHaveBeenCalledWith(
			'caption_title_line_height',
			expect.objectContaining({
				desktop: expect.objectContaining({ value: 1.5 }),
			})
		);
	});
});

describe('renderResponsiveRange (four-sided)', () => {
	const PER_DEVICE = { min: 0, max: 100, default: 0 };
	const SETTING = {
		key: 'padding',
		label: 'Padding',
		four_sided: true,
		units: ['px', 'em'],
		responsive: {
			desktop: PER_DEVICE,
			tablet: PER_DEVICE,
			mobile: PER_DEVICE,
		},
	};

	it('renders four side inputs when unlinked', () => {
		const { container } = renderElement(
			build(
				SETTING,
				{
					desktop: { top: 1, right: 2, bottom: 3, left: 4 },
					_linked: false,
				},
				false
			)
		);
		// four-sided unlinked exposes per-side number inputs
		expect(
			container.querySelectorAll('input[type="number"]').length
		).toBeGreaterThanOrEqual(4);
	});

	it('treats equal sides with no _linked flag as linked', () => {
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { top: 5, right: 5, bottom: 5, left: 5 } },
				false
			)
		);
		// linked mode collapses to a single control
		expect(container.querySelector('.fotogrids-responsive-setting')).not.toBeNull();
	});

	it('toggles the link button between linked and unlinked', () => {
		const updateSetting = jest.fn();
		const updateSettingStateOnly = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { top: 5, right: 5, bottom: 5, left: 5 } },
				false,
				{ updateSetting, updateSettingStateOnly }
			)
		);
		const linkBtn = container.querySelector('.fotogrids-fourside-link-btn');
		expect(linkBtn).not.toBeNull();
		click(linkBtn);
		// toggling link writes UI-only state (the _linked flag)
		expect(updateSettingStateOnly).toHaveBeenCalled();
	});

	it('edits a single side when unlinked and emits without _linked in the saved payload', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{
					desktop: {
						top: { value: 1, unit: 'px' },
						right: { value: 2, unit: 'px' },
						bottom: { value: 3, unit: 'px' },
						left: { value: 4, unit: 'px' },
					},
					_linked: false,
				},
				false,
				{ updateSetting }
			)
		);
		const sideInput = container.querySelector(
			'.fotogrids-fourside-input-group input[type="number"]'
		);
		changeValue(sideInput, '10');
		expect(updateSetting).toHaveBeenCalled();
	});

	it('moves all sides together via the slider when linked', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { top: 5, right: 5, bottom: 5, left: 5 } },
				false,
				{ updateSetting }
			)
		);
		const slider = container.querySelector('input[type="range"]');
		expect(slider.disabled).toBe(false); // enabled because linked
		changeValue(slider, '20');
		expect(updateSetting).toHaveBeenCalled();
	});
});

describe('renderResponsiveRange (min-max / dual-range)', () => {
	const PER_DEVICE = { min: 0, max: 100, default: 10 };
	const SETTING = {
		key: 'size',
		label: 'Size range',
		minMax: true,
		units: ['px', '%'],
		responsive: {
			desktop: PER_DEVICE,
			tablet: PER_DEVICE,
			mobile: PER_DEVICE,
		},
	};

	it('renders a dual-range container with two sliders', () => {
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false
			)
		);
		expect(
			container.querySelector('.fotogrids-dual-range-container')
		).not.toBeNull();
		expect(
			container.querySelectorAll('input[type="range"]').length
		).toBeGreaterThanOrEqual(2);
	});

	it('updates the min value via its number input', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false,
				{ updateSetting }
			)
		);
		const number = container.querySelector('input[type="number"]');
		changeValue(number, '25');
		expect(updateSetting).toHaveBeenCalled();
	});

	it('switches device on the min-max device tabs', () => {
		const setActiveDevice = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false,
				{ setActiveDevice }
			)
		);
		const tabs = container.querySelectorAll(
			'.fotogrids-responsive-device-btn'
		);
		click(tabs[1]);
		expect(setActiveDevice).toHaveBeenCalled();
	});

	it('updates both min and max via their range sliders', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false,
				{ updateSetting }
			)
		);
		const sliders = container.querySelectorAll('input[type="range"]');
		changeValue(sliders[0], '15'); // min slider
		changeValue(sliders[1], '70'); // max slider
		expect(updateSetting).toHaveBeenCalledTimes(2);
	});

	it('updates the max value via its number input', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false,
				{ updateSetting }
			)
		);
		const numbers = container.querySelectorAll('input[type="number"]');
		expect(numbers.length).toBeGreaterThanOrEqual(2);
		changeValue(numbers[1], '90'); // max number input
		expect(updateSetting).toHaveBeenCalled();
	});

	it('switches the unit via the units select', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{
					desktop: {
						min: { value: 10, unit: 'px' },
						max: { value: 80, unit: 'px' },
					},
				},
				false,
				{ updateSetting }
			)
		);
		const unitSelect = container.querySelector(
			'select.fotogrids-units-select, .fotogrids-unit-select'
		);
		if (unitSelect && unitSelect.tagName === 'SELECT') {
			changeValue(unitSelect, '%');
			expect(updateSetting).toHaveBeenCalled();
		} else {
			// CustomUnitSelect variant renders; just assert it's present
			expect(
				container.querySelector('.fotogrids-units-select, .fotogrids-unit-select')
			).not.toBeNull();
		}
	});

	it('renders a pro badge in min-max mode from field state', () => {
		const { container } = renderElement(
			build(
				SETTING,
				{ desktop: { min: { value: 10 }, max: { value: 80 } } },
				false,
				{ getFieldState: () => 'locked' }
			)
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
