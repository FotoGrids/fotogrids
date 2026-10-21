/**
 * Tests for renderPresetGroup.js
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/utils/settings-mode';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderPresetGroup';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (name) => `icon:${name}`;

const SETTING = {
	id: 'easy_spacing',
	type: 'preset_group',
	label: 'Spacing',
	description: 'Space between items.',
	options: [
		{
			value: 'none',
			label: 'None',
			icon: 'spacing_none',
			values: { item_spacing: { desktop: 0, tablet: 0, mobile: 0 } },
		},
		{
			value: 'small',
			label: 'Small',
			icon: 'spacing_small',
			values: { item_spacing: { desktop: 10, tablet: 8, mobile: 5 } },
		},
		{
			value: 'large',
			label: 'Large',
			icon: 'spacing_large',
			values: { item_spacing: { desktop: 30, tablet: 20, mobile: 10 } },
		},
	],
};

const build = (setting, values, disabled = false, deps = {}) =>
	window.FotoGridsRenderSettings.renderPresetGroup(setting, values, disabled, {
		applyPreset: jest.fn(),
		renderIcon,
		__,
		...deps,
	});

const buttons = (container) => [
	...container.querySelectorAll('.fg-button-group__button'),
];

describe('renderPresetGroup', () => {
	it('renders a big-icon button group with the matching option active', () => {
		const { container } = renderElement(
			build(SETTING, {
				item_spacing: { desktop: '10', tablet: 8, mobile: 5 },
			})
		);
		const root = container.firstChild;
		expect(root.className).toBe(
			'fotogrids-button-group fg-button-group--big-icons fg-button-group--same-width'
		);
		expect(
			container.querySelector('.fotogrids-setting__label').textContent
		).toBe('Spacing');
		const [none, small, large] = buttons(container);
		expect(small.className).toContain('fg-is-active');
		expect(none.className).not.toContain('fg-is-active');
		expect(large.title).toBe('Large');
		expect(none.querySelector('.fg-button-icon').textContent).toBe(
			'icon:spacing_none'
		);
		expect(container.textContent).toContain('Space between items.');
	});

	it('renders plain text buttons when bigIcons is false', () => {
		const applyPreset = jest.fn();
		const width = {
			id: 'easy_border_width',
			type: 'preset_group',
			label: 'Border Width',
			bigIcons: false,
			options: [
				{ value: 'thin', label: 'Thin', values: { border_width: 1 } },
				{ value: 'thick', label: 'Thick', values: { border_width: 4 } },
			],
		};
		const { container } = renderElement(
			build(width, { border_width: 1 }, false, { applyPreset })
		);
		expect(container.firstChild.className).not.toContain(
			'fg-button-group--big-icons'
		);
		const [thin, thick] = buttons(container);
		expect(thin.className).toContain('fg-is-active');
		expect(thin.textContent).toContain('Thin');
		expect(thin.querySelector('.fg-button-icon')).toBeNull();
		click(thick);
		expect(applyPreset).toHaveBeenCalledWith(
			{ border_width: 4 },
			expect.objectContaining({ value: 'thick' })
		);
	});

	it('passes the picked option values to applyPreset once', () => {
		const applyPreset = jest.fn();
		const { container } = renderElement(
			build(
				SETTING,
				{ item_spacing: { desktop: 0, tablet: 0, mobile: 0 } },
				false,
				{ applyPreset }
			)
		);
		click(buttons(container)[2]);
		expect(applyPreset).toHaveBeenCalledTimes(1);
		expect(applyPreset).toHaveBeenCalledWith(
			{ item_spacing: { desktop: 30, tablet: 20, mobile: 10 } },
			expect.objectContaining({ value: 'large' })
		);
		// Clicking the selected option writes nothing.
		click(buttons(container)[0]);
		expect(applyPreset).toHaveBeenCalledTimes(1);
	});

	it('selects nothing and adds no text when no option matches', () => {
		const { container } = renderElement(
			build(SETTING, { item_spacing: { desktop: 3 } })
		);
		expect(container.querySelector('.fg-is-active')).toBeNull();
		expect(container.textContent).not.toContain('Custom');
		expect(container.textContent).not.toContain('Show in Advanced');
		expect(buttons(container)).toHaveLength(3);
	});

	it('disables every option when the field is disabled', () => {
		const applyPreset = jest.fn();
		const { container } = renderElement(
			build(SETTING, {}, true, { applyPreset })
		);
		expect(buttons(container).every((b) => b.disabled)).toBe(true);
	});

	it('locks an option whose keys are gated and never applies it', () => {
		const applyPreset = jest.fn();
		const getFieldState = (k, v) =>
			v && v.desktop === 30 ? 'teaser' : 'editable';
		const { container } = renderElement(
			build(SETTING, {}, false, { getFieldState, applyPreset })
		);
		const [none, , large] = buttons(container);
		expect(none.disabled).toBe(false);
		expect(large.disabled).toBe(true);
		expect(large.className).toContain('fg-button-group__button__pro');

		const updateSetting = jest.fn();
		const spy = jest
			.spyOn(window.FotoGridsRenderSettings, 'renderButtonGroup')
			.mockImplementation((s, v, d, ctx) => {
				updateSetting.ctx = ctx;
				return null;
			});
		build(SETTING, {}, false, { getFieldState, applyPreset });
		updateSetting.ctx.updateSetting('easy_spacing', 'large');
		updateSetting.ctx.updateSetting('easy_spacing', 'missing');
		expect(applyPreset).not.toHaveBeenCalled();
		expect(updateSetting.ctx.getOptionState('easy_spacing', 'missing')).toBe(
			'editable'
		);
		spy.mockRestore();
	});

	it('keeps long labels at natural width unless sameWidth is set', () => {
		const long = {
			id: 'easy_caption_style',
			label: 'Caption Style',
			options: [
				{ value: 'a', label: 'Below the image', values: { x: 1 } },
				{ value: 'b', label: 'On hover', values: { x: 2 } },
			],
		};
		const { container: natural } = renderElement(build(long, { x: 1 }));
		expect(natural.firstChild.className).not.toContain('same-width');
		const { container: forced } = renderElement(
			build({ ...long, sameWidth: true }, { x: 1 })
		);
		expect(forced.firstChild.className).toContain(
			'fg-button-group--same-width'
		);
	});

	it('falls back to the shared icon set without a renderIcon', () => {
		window.FotoGridsIcons = { spacing_none: '<svg data-x="1"></svg>' };
		try {
			const { container } = renderElement(
				window.FotoGridsRenderSettings.renderPresetGroup(
					SETTING,
					{},
					false,
					{ applyPreset: jest.fn() }
				)
			);
			const [none, small] = buttons(container);
			expect(none.querySelector('svg[data-x="1"]')).not.toBeNull();
			expect(small.querySelector('.fg-button-icon').textContent).toBe('');
		} finally {
			delete window.FotoGridsIcons;
		}
	});

	it('tolerates malformed options and a missing label', () => {
		const { container } = renderElement(
			build(
				{
					options: [null, { value: 'x', label: 'X', values: null }],
				},
				{}
			)
		);
		expect(buttons(container)).toHaveLength(1);
		expect(container.querySelector('.fotogrids-setting__label')).toBeNull();
		expect(container.querySelector('.fg-is-active')).toBeNull();
	});

	it('selects nothing when the helpers are unavailable', () => {
		const helpers = window.FotoGridsSettingsMode;
		delete window.FotoGridsSettingsMode;
		try {
			const { container } = renderElement(
				build({ options: SETTING.options }, {})
			);
			expect(container.querySelector('.fg-is-active')).toBeNull();
		} finally {
			window.FotoGridsSettingsMode = helpers;
		}
	});

	it('renders nothing without renderButtonGroup', () => {
		const real = window.FotoGridsRenderSettings.renderButtonGroup;
		delete window.FotoGridsRenderSettings.renderButtonGroup;
		try {
			expect(build(SETTING, {})).toBeNull();
		} finally {
			window.FotoGridsRenderSettings.renderButtonGroup = real;
		}
	});
});
