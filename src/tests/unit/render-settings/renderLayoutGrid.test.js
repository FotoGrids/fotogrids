/**
 * Tests for renderLayoutGrid.js
 */
import '@/admin/plain/render-settings/renderLayoutGrid';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;
const OPTIONS = [
	{ value: 'grid', label: 'Grid', description: 'Boxes', icon: 'grid' },
	{ value: 'masonry', label: 'Masonry', description: 'Bricks', icon: 'm' },
];
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderLayoutGrid(setting, value, disabled, {
		updateSetting: jest.fn(),
		renderIcon,
		__,
		...deps,
	});

describe('renderLayoutGrid', () => {
	afterEach(() => {
		delete window.FotoGridsUpgrade;
	});

	it('renders an option card per layout and marks the active one', () => {
		const { container } = renderElement(
			build({ key: 'layout', label: 'Layout', options: OPTIONS }, 'masonry', false)
		);
		const cards = container.querySelectorAll('.fotogrids-layout-option');
		expect(cards).toHaveLength(2);
		expect(
			container.querySelector('.fg-is-active .fotogrids-layout-option__name')
				.textContent
		).toBe('Masonry');
	});

	it('updates the setting when a card is clicked', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'layout', options: OPTIONS }, 'grid', false, {
				updateSetting,
			})
		);
		click(container.querySelectorAll('.fotogrids-layout-option')[1]);
		expect(updateSetting).toHaveBeenCalledWith('layout', 'masonry');
	});

	it('does not update disabled cards', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'layout', options: OPTIONS }, 'grid', true, {
				updateSetting,
			})
		);
		click(container.querySelectorAll('.fotogrids-layout-option')[1]);
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('shows a Pro badge for teaser options and launches upgrade on click', () => {
		const launch = jest.fn();
		window.FotoGridsUpgrade = {
			launchForFeature: { advancedLayouts: launch },
		};
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'layout', options: OPTIONS }, 'grid', false, {
				updateSetting,
				getOptionState: (k, v) => (v === 'masonry' ? 'teaser' : 'editable'),
			})
		);
		const proCard = container.querySelectorAll('.fotogrids-layout-option')[1];
		expect(
			proCard.querySelector('.fotogrids-pro-badge__absolute').textContent
		).toBe('Pro');
		click(proCard);
		expect(updateSetting).not.toHaveBeenCalled();
		expect(launch).toHaveBeenCalled();
	});

	it('shows a Locked badge for locked options', () => {
		const { container } = renderElement(
			build({ key: 'layout', options: OPTIONS }, 'grid', false, {
				getOptionState: (k, v) => (v === 'masonry' ? 'locked' : 'editable'),
			})
		);
		expect(
			container
				.querySelectorAll('.fotogrids-layout-option')[1]
				.querySelector('.fotogrids-pro-badge__absolute').textContent
		).toBe('Locked');
	});

	it('shows a field-level badge from field state', () => {
		const { container } = renderElement(
			build({ key: 'layout', label: 'L', options: OPTIONS }, 'grid', false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-setting__label .fotogrids-pro-badge')
				.textContent
		).toBe('Locked');
	});
});
