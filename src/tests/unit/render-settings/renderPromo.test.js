/**
 * Tests for renderPromo.js
 */
import '@/admin/plain/render-settings/renderPromo';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting) =>
	window.FotoGridsRenderSettings.renderPromo(setting, null, false, { __ });

describe('renderPromo', () => {
	afterEach(() => {
		delete window.fotogridsUpgradeModal;
		delete window.fotogridsSettings;
	});

	it('renders a PRO badge and Upgrade button', () => {
		const { container } = renderElement(build({ message: 'Go pro' }));
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('PRO');
		expect(container.textContent).toContain('Upgrade Now');
	});

	it('falls back to a single message from setting.message', () => {
		const { container } = renderElement(build({ message: 'Hello pro' }));
		expect(container.textContent).toContain('Hello pro');
	});

	it('renders multiple messages with subtitles', () => {
		const { container } = renderElement(
			build({
				messages: [
					{ subtitle: 'Sub', message: 'First' },
					{ message: 'Second' },
				],
			})
		);
		expect(
			container.querySelector('.fotogrids-settings_pro-message__subtitle')
				.textContent
		).toBe('Sub');
		expect(container.textContent).toContain('First');
		expect(container.textContent).toContain('Second');
	});

	it('renders a Learn more link when learn_more is set', () => {
		window.fotogridsSettings = {
			proLinkTemplate:
				'https://go.fotogrids.com/{{path}}?utm_source=plugin&utm_medium=collection-settings&utm_campaign=feature',
		};
		const { container } = renderElement(
			build({ messages: [{ message: 'm', learn_more: 'layouts' }] })
		);
		const link = container.querySelector(
			'a.fotogrids-settings_pro-message__learn-more'
		);
		expect(link.href).toContain('go.fotogrids.com/layouts');
		expect(link.href).toContain('utm_medium=collection-settings');
		expect(link.href).toContain('utm_campaign=feature');
	});

	it('opens the upgrade URL on click when configured', () => {
		window.fotogridsUpgradeModal = {
			urls: { upgrade: 'https://go.fotogrids.com/up' },
		};
		const open = jest.spyOn(window, 'open').mockImplementation(() => {});
		const { container } = renderElement(build({ message: 'm' }));
		click(container.querySelector('button.fg-button'));
		expect(open).toHaveBeenCalledWith(
			'https://go.fotogrids.com/up',
			'_blank'
		);
		open.mockRestore();
	});

	it('does not throw clicking upgrade when no URL configured', () => {
		const open = jest.spyOn(window, 'open').mockImplementation(() => {});
		const { container } = renderElement(build({ message: 'm' }));
		click(container.querySelector('button.fg-button'));
		expect(open).not.toHaveBeenCalled();
		open.mockRestore();
	});
});
