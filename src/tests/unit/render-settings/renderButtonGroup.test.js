/**
 * Tests for renderButtonGroup.js (+ ProBadge integration)
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderButtonGroup';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (name) => `icon:${name}`;
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderButtonGroup(setting, value, disabled, {
		updateSetting: jest.fn(),
		renderIcon,
		__,
		...deps,
	});

const OPTIONS = [
	{ value: 'a', label: 'A', icon: 'star' },
	{ value: 'b', label: 'B' },
];

describe('renderButtonGroup', () => {
	it('renders one button per option and marks the active one', () => {
		const { container } = renderElement(
			build({ key: 'k', label: 'Pick', options: OPTIONS }, 'b', false)
		);
		const buttons = container.querySelectorAll('.fg-button-group__button');
		expect(buttons).toHaveLength(2);
		expect(
			container.querySelector('.fg-is-active').textContent
		).toContain('B');
		expect(container.textContent).toContain('Pick');
	});

	it('updates the setting on click', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'k', options: OPTIONS }, 'a', false, { updateSetting })
		);
		click(container.querySelectorAll('.fg-button-group__button')[1]);
		expect(updateSetting).toHaveBeenCalledWith('k', 'b');
	});

	it('does not update when disabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'k', options: OPTIONS }, 'a', true, { updateSetting })
		);
		click(container.querySelectorAll('.fg-button-group__button')[1]);
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('renders the icon via renderIcon', () => {
		const { container } = renderElement(
			build({ key: 'k', options: OPTIONS }, 'a', false)
		);
		expect(container.querySelector('.fg-button-icon').textContent).toBe(
			'icon:star'
		);
	});

	it('filters out global-default options in defaults mode', () => {
		const opts = [
			{ value: 'a', label: 'A' },
			{ value: 'inherit', label: 'Inherit', isGlobalDefault: true },
		];
		const { container } = renderElement(
			build({ key: 'k', options: opts }, 'a', false, {
				isDefaultsMode: true,
			})
		);
		expect(
			container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(1);
	});

	it('hides options that fail isOptionVisible', () => {
		const { container } = renderElement(
			build({ key: 'k', options: OPTIONS }, 'a', false, {
				isOptionVisible: (o) => o.value !== 'b',
			})
		);
		expect(
			container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(1);
	});

	it('renders an empty slot for null options (alignment grid)', () => {
		const { container } = renderElement(
			build(
				{ key: 'k', options: [{ value: 'a', label: 'A' }, null] },
				'a',
				false
			)
		);
		expect(
			container.querySelector('.fg-button-group__button--empty')
		).not.toBeNull();
	});

	it('marks pro options disabled and shows a badge', () => {
		const { container } = renderElement(
			build(
				{ key: 'k', options: [{ value: 'p', label: 'Pro opt' }] },
				'a',
				false,
				{
					getOptionState: () => 'locked',
				}
			)
		);
		const btn = container.querySelector('.fg-button-group__button__pro');
		expect(btn).not.toBeNull();
		expect(btn.disabled).toBe(true);
	});

	it('renders the description HTML', () => {
		const { container } = renderElement(
			build(
				{ key: 'k', options: OPTIONS, description: '<b>hint</b>' },
				'a',
				false
			)
		);
		expect(
			container.querySelector('.fotogrids-setting__description b')
				.textContent
		).toBe('hint');
	});
});
