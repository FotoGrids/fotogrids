/**
 * Tests for renderHoverEffectsGrid.js
 */
import '@/admin/plain/render-settings/renderHoverEffectsGrid';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const OPTIONS = [
	{ value: 'none', label: 'None', animates: 'none' },
	{ value: 'zoom', label: 'Zoom', animates: 'media' },
	{
		value: 'reveal',
		label: 'Reveal',
		animates: 'caption',
		requires_caption: true,
	},
];

const build = (value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderHoverEffectsGrid(
		{ key: 'hover', label: 'Hover', options: OPTIONS },
		value,
		disabled,
		{ updateSetting: jest.fn(), renderIcon, __, settings: {}, ...deps }
	);

describe('renderHoverEffectsGrid', () => {
	afterEach(() => {
		delete window.FotoGridsUpgrade;
	});

	it('renders one card per option and marks the active one', () => {
		const { container } = renderElement(build('zoom', false));
		const cards = container.querySelectorAll(
			'.fotogrids-hover-effect-option'
		);
		expect(cards).toHaveLength(3);
		expect(container.querySelectorAll('.fg-is-active')).toHaveLength(1);
	});

	it('updates the setting when a card is clicked', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build('none', false, { updateSetting })
		);
		const zoomCard = container.querySelectorAll(
			'.fotogrids-hover-effect-option'
		)[1];
		click(zoomCard);
		expect(updateSetting).toHaveBeenCalledWith('hover', 'zoom');
	});

	it('launches the upgrade flow for a teaser option', () => {
		const launch = jest.fn();
		window.FotoGridsUpgrade = { launchForFeature: { customCSS: launch } };
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build('none', false, {
				updateSetting,
				getOptionState: (k, v) => (v === 'zoom' ? 'teaser' : 'editable'),
			})
		);
		click(
			container.querySelectorAll('.fotogrids-hover-effect-option')[1]
		);
		expect(updateSetting).not.toHaveBeenCalled();
		expect(launch).toHaveBeenCalled();
	});

	it('flags a caption-revealing effect as broken when captions are hidden', () => {
		const { container } = renderElement(
			build('none', false, {
				settings: {
					caption_hide_title: '1',
					caption_hide_description: '1',
				},
			})
		);
		expect(container.querySelector('.fg-is-broken')).not.toBeNull();
	});

	it('does not flag broken when a caption is visible', () => {
		const { container } = renderElement(
			build('none', false, {
				settings: { caption_hide_title: '1' },
			})
		);
		expect(container.querySelector('.fg-is-broken')).toBeNull();
	});
});
