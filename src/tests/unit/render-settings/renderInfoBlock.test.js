/**
 * Tests for renderInfoBlock.js
 */
import '@/admin/plain/render-settings/renderInfoBlock';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting) =>
	window.FotoGridsRenderSettings.renderInfoBlock(setting, null, false, { __ });

describe('renderInfoBlock', () => {
	afterEach(() => {
		delete window.fotogridsSettings;
		delete window.FotoGridsIcons;
	});

	it('renders the message as HTML', () => {
		const { container } = renderElement(
			build({ message: 'A <strong>bold</strong> notice' })
		);
		expect(
			container.querySelector('.fotogrids-settings_info-block__text strong')
				.textContent
		).toBe('bold');
	});

	it('falls back to description when message is absent', () => {
		const { container } = renderElement(
			build({ description: 'fallback' })
		);
		expect(container.textContent).toContain('fallback');
	});

	it('renders a subtitle when present', () => {
		const { container } = renderElement(
			build({ subtitle: 'Heads up', message: 'm' })
		);
		expect(
			container.querySelector('.fotogrids-settings_info-block__subtitle')
				.textContent
		).toBe('Heads up');
	});

	it('adds the full-width modifier class', () => {
		const { container } = renderElement(
			build({ message: 'm', full_width: true })
		);
		expect(
			container.querySelector('.fotogrids-settings_info-block--full-width')
		).not.toBeNull();
	});

	it('uses an inline SVG icon from FotoGridsIcons when available', () => {
		window.FotoGridsIcons = { info_square: '<svg id="ico"></svg>' };
		const { container } = renderElement(build({ message: 'm' }));
		expect(container.querySelector('#ico')).not.toBeNull();
	});

	it('renders an action button that opens the URL', () => {
		const open = jest
			.spyOn(window, 'open')
			.mockImplementation(() => {});
		const { container } = renderElement(
			build({
				message: 'm',
				button_label: 'Go',
				button_url: 'https://x.test',
			})
		);
		const btn = container.querySelector('button.fg-button');
		expect(btn.textContent).toBe('Go');
		click(btn);
		expect(open).toHaveBeenCalledWith(
			'https://x.test',
			'_blank',
			'noopener,noreferrer'
		);
		open.mockRestore();
	});

	it('resolves a dynamic button URL from window.fotogridsSettings', () => {
		window.fotogridsSettings = { dash_url: 'https://dash.test' };
		const open = jest
			.spyOn(window, 'open')
			.mockImplementation(() => {});
		const { container } = renderElement(
			build({
				message: 'm',
				button_label: 'Dash',
				button_url_key: 'dash_url',
			})
		);
		click(container.querySelector('button.fg-button'));
		expect(open).toHaveBeenCalledWith(
			'https://dash.test',
			'_blank',
			'noopener,noreferrer'
		);
		open.mockRestore();
	});

	it('omits the button when no URL resolves', () => {
		const { container } = renderElement(
			build({ message: 'm', button_label: 'Go' })
		);
		expect(container.querySelector('button.fg-button')).toBeNull();
	});
});
