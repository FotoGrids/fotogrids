/**
 * Renders the preset_group combined control as a big-icon button group.
 *
 * @since 1.3.0
 */
window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

(function () {
	'use strict';

	const SAME_WIDTH_MAX_LABEL = 12;

	const defaultRenderIcon = (name) => {
		const svg = window.FotoGridsIcons?.[name];
		if (!svg) {
			return null;
		}
		return wp.element.createElement('span', {
			className: 'fotogrids-icon',
			dangerouslySetInnerHTML: { __html: svg },
		});
	};

	/**
	 * Combined control: each option writes several settings at once.
	 *
	 * @since 1.3.0
	 * @param {Object} setting preset_group node.
	 * @param {Object} currentValues Key to current value for every preset key.
	 * @param {boolean} isDisabled
	 * @param {Object} context
	 * @param {(values: Object, option: Object) => void} context.applyPreset
	 * @param {(key: string, value: unknown) => string} [context.getFieldState]
	 * @param {(name: string) => unknown} [context.renderIcon]
	 * @param {(text: string, domain: string) => string} [context.__]
	 * @returns {Object|null} wp.element node.
	 */
	window.FotoGridsRenderSettings.renderPresetGroup = (
		setting,
		currentValues,
		isDisabled,
		{ applyPreset, getFieldState, renderIcon, __ }
	) => {
		const renderButtonGroup =
			window.FotoGridsRenderSettings.renderButtonGroup;
		if (typeof renderButtonGroup !== 'function') {
			return null;
		}
		const helpers = window.FotoGridsSettingsMode || {};
		const options = (Array.isArray(setting.options) ? setting.options : [])
			.filter((option) => option && typeof option === 'object')
			.map((option) => ({
				...option,
				values:
					option.values && typeof option.values === 'object'
						? option.values
						: {},
			}));
		const selected =
			typeof helpers.matchPreset === 'function'
				? helpers.matchPreset(options, currentValues)
				: null;
		const selectedValue = selected ? selected.value : null;

		const optionState = (option) => {
			if (typeof getFieldState !== 'function') {
				return 'editable';
			}
			for (const key of Object.keys(option.values)) {
				const state = getFieldState(key, option.values[key]);
				if (state !== 'editable') {
					return state;
				}
			}
			return 'editable';
		};

		const byValue = (value) =>
			options.find((option) => String(option.value) === String(value));

		const sameWidth =
			typeof setting.sameWidth === 'boolean'
				? setting.sameWidth
				: options.every(
						(option) =>
							String(option.label || '').length <=
							SAME_WIDTH_MAX_LABEL
					);

		const buttonSetting = {
			key: setting.id || 'preset_group',
			label: setting.label,
			description: setting.description,
			bigIcons: setting.bigIcons !== false,
			sameWidth,
			options: options.map((option) => ({
				value: option.value,
				label: option.label,
				icon: option.icon,
			})),
		};

		return renderButtonGroup(buttonSetting, selectedValue, isDisabled, {
			updateSetting: (_key, value) => {
				const option = byValue(value);
				if (
					!option ||
					option.value === selectedValue ||
					optionState(option) !== 'editable'
				) {
					return;
				}
				applyPreset(option.values, option);
			},
			renderIcon:
				typeof renderIcon === 'function'
					? renderIcon
					: defaultRenderIcon,
			getOptionState: (_key, value) => {
				const option = byValue(value);
				return option ? optionState(option) : 'editable';
			},
			__,
		});
	};
})();
