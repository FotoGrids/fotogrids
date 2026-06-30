/**
 * Tests for renderGroup.js and renderSideBySide.js (composition wrappers)
 */
import '@/admin/plain/render-settings/renderGroup';
import '@/admin/plain/render-settings/renderSideBySide';
import { renderElement } from '@tests/helpers/render-component';

const __ = (t) => t;

describe('renderSideBySide', () => {
	const build = (setting, deps = {}) =>
		window.FotoGridsRenderSettings.renderSideBySide(setting, null, false, {
			renderSetting: (s) => wp.element.createElement('span', null, s.label),
			...deps,
		});

	it('returns null without a settings array', () => {
		expect(build({ key: 'k' })).toBeNull();
		expect(build({ key: 'k', settings: 'x' })).toBeNull();
	});

	it('renders each child setting', () => {
		const { container } = renderElement(
			build({
				settings: [{ label: 'One' }, { label: 'Two' }],
			})
		);
		expect(container.querySelector('.fotogrids-settings-sbs')).not.toBeNull();
		expect(container.textContent).toContain('One');
		expect(container.textContent).toContain('Two');
	});
});

describe('renderGroup', () => {
	const build = (setting, disabled, deps = {}) =>
		window.FotoGridsRenderSettings.renderGroup(setting, null, disabled, {
			renderSetting: (s) =>
				wp.element.createElement('span', { key: s.label }, s.label),
			__,
			...deps,
		});

	it('renders an error box for invalid group settings', () => {
		const { container } = renderElement(build({ key: 'k' }, false));
		expect(
			container.querySelector('.fotogrids-setting-group--error')
		).not.toBeNull();
	});

	it('renders a fieldset with legend and children by default', () => {
		const { container } = renderElement(
			build(
				{ label: 'Group', settings: [{ label: 'Child' }] },
				false
			)
		);
		expect(container.querySelector('fieldset')).not.toBeNull();
		expect(container.querySelector('legend').textContent).toContain(
			'Group'
		);
		expect(container.textContent).toContain('Child');
	});

	it('adds a disabled modifier when disabled', () => {
		const { container } = renderElement(
			build({ label: 'G', settings: [{ label: 'C' }] }, true)
		);
		expect(
			container.querySelector('.fotogrids-setting-group--disabled')
		).not.toBeNull();
	});

	it('renders chromeless when chrome_when=single_subtab outside that context', () => {
		const { container } = renderElement(
			build(
				{
					label: 'G',
					settings: [{ label: 'C' }],
					chrome_when: 'single_subtab',
				},
				false
			)
		);
		expect(
			container.querySelector('.fotogrids-setting-group--chromeless')
		).not.toBeNull();
		expect(container.querySelector('fieldset')).toBeNull();
	});

	it('renders chrome when chrome_when matches the single_subtab context', () => {
		const { container } = renderElement(
			build(
				{
					label: 'G',
					settings: [{ label: 'C' }],
					chrome_when: 'single_subtab',
					__chromeWhenContext: 'single_subtab',
				},
				false
			)
		);
		expect(container.querySelector('fieldset')).not.toBeNull();
	});

	it('shows a pro badge from field state', () => {
		const { container } = renderElement(
			build({ label: 'G', settings: [{ label: 'C' }] }, false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
