/**
 * Tests for renderSettingSubTabs.js
 */
import '@/admin/plain/render-settings/renderSettingSubTabs';
import { renderElement, click } from '@tests/helpers/render-component';

const renderIcon = (n) => n;
const renderSetting = (s) =>
	wp.element.createElement('span', { key: s.label }, s.label);

const build = (setting, deps = {}) =>
	window.FotoGridsRenderSettings.renderSettingSubTabs(setting, false, {
		activeSubTab: 'one',
		setActiveSubTab: jest.fn(),
		renderIcon,
		renderSetting,
		...deps,
	});

const MULTI = {
	subTabs: {
		one: {
			id: 'one',
			label: 'One',
			icon: 'i',
			settings: [{ label: 'OneField' }],
		},
		two: {
			id: 'two',
			label: 'Two',
			icon: 'i',
			settings: [{ label: 'TwoField' }],
		},
	},
};

describe('renderSettingSubTabs', () => {
	it('returns null without subTabs', () => {
		expect(build({})).toBeNull();
	});

	it('renders single-subtab content without a nav', () => {
		const { container } = renderElement(
			build({
				subTabs: {
					only: { id: 'only', settings: [{ label: 'Solo' }] },
				},
			})
		);
		expect(
			container.querySelector(
				'.fotogrids-lightbox-subtab-content--single'
			)
		).not.toBeNull();
		expect(container.textContent).toContain('Solo');
	});

	it('renders a nav and the active tab content for multiple subtabs', () => {
		const { container } = renderElement(build(MULTI));
		const tabs = container.querySelectorAll('.fotogrids-lightbox-subtab');
		expect(tabs).toHaveLength(2);
		expect(container.querySelector('.fg-is-active').textContent).toContain(
			'One'
		);
		expect(container.textContent).toContain('OneField');
	});

	it('switches tab on click', () => {
		const setActiveSubTab = jest.fn();
		const { container } = renderElement(
			build(MULTI, { setActiveSubTab })
		);
		click(container.querySelectorAll('.fotogrids-lightbox-subtab')[1]);
		expect(setActiveSubTab).toHaveBeenCalledWith('two');
	});

	it('falls back to the first tab when the active id is not visible', () => {
		const { container } = renderElement(
			build(MULTI, { activeSubTab: 'missing' })
		);
		// resolves to the first subtab's settings
		expect(container.textContent).toContain('OneField');
	});

	it('filters subtabs by condition via shouldDisplaySetting', () => {
		const { container } = renderElement(
			build(MULTI_WITH_CONDITION, {
				shouldDisplaySetting: ({ condition }) =>
					condition.show === true,
			})
		);
		// only the 'two' tab (show:true) survives -> single layout
		expect(
			container.querySelector(
				'.fotogrids-lightbox-subtab-content--single'
			)
		).not.toBeNull();
		expect(container.textContent).toContain('TwoField');
	});
});

const MULTI_WITH_CONDITION = {
	subTabs: {
		one: {
			id: 'one',
			label: 'One',
			condition: { show: false },
			settings: [{ label: 'OneField' }],
		},
		two: {
			id: 'two',
			label: 'Two',
			condition: { show: true },
			settings: [{ label: 'TwoField' }],
		},
	},
};
