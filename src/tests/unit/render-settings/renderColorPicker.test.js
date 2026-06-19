/**
 * Tests for renderColorPicker.js (swatch + FGColorPicker popover)
 */
import '@/admin/plain/render-settings/utils/fg-color-picker';
import '@/admin/plain/render-settings/renderColorPicker';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;

function stubCanvas() {
	const grad = { addColorStop: jest.fn() };
	jest.spyOn(
		window.HTMLCanvasElement.prototype,
		'getContext'
	).mockReturnValue({
		createLinearGradient: jest.fn(() => grad),
		fillRect: jest.fn(),
		set fillStyle(v) {},
		get fillStyle() {
			return '';
		},
	});
}

const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderColorPicker(setting, value, disabled, {
		updateSetting: jest.fn(),
		__,
		...deps,
	});

describe('renderColorPicker', () => {
	let mounted = [];
	const mount = (el) => {
		const h = renderElement(el);
		mounted.push(h);
		return h;
	};

	beforeEach(() => stubCanvas());

	afterEach(() => {
		mounted.forEach((h) => h.unmount());
		mounted = [];
		jest.restoreAllMocks();
		document.head.innerHTML = '';
	});

	it('renders a swatch showing the current colour', () => {
		const { container } = mount(
			build({ key: 'c', label: 'Border' }, '#ff0000', false)
		);
		expect(
			container.querySelector('.fotogrids-color-swatch__fill').style
				.background
		).toContain('rgb(255, 0, 0)');
		expect(container.querySelector('input.fotogrids-color-text').value).toBe(
			'#ff0000'
		);
	});

	it('falls back to the default colour when value is empty', () => {
		const { container } = mount(
			build({ key: 'c', default: '#123456' }, '', false)
		);
		expect(container.querySelector('input.fotogrids-color-text').value).toBe(
			'#123456'
		);
	});

	it('opens a popover with the FGColorPicker widget on swatch click', () => {
		const { container } = mount(build({ key: 'c' }, '#000000', false));
		click(container.querySelector('.fotogrids-color-swatch'));
		const popover = document.querySelector('.fotogrids-color-popover--open');
		expect(popover).not.toBeNull();
		expect(popover.querySelector('.fg-cp')).not.toBeNull();
	});

	it('does not open when disabled', () => {
		const { container } = mount(build({ key: 'c' }, '#000000', true));
		click(container.querySelector('.fotogrids-color-swatch'));
		expect(
			document.querySelector('.fotogrids-color-popover--open')
		).toBeNull();
	});

	it('closes the popover on Escape', () => {
		const { container } = mount(build({ key: 'c' }, '#000000', false));
		click(container.querySelector('.fotogrids-color-swatch'));
		expect(
			document.querySelector('.fotogrids-color-popover--open')
		).not.toBeNull();
		act(() => {
			document.dispatchEvent(
				new window.KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
				})
			);
		});
		expect(
			document.querySelector('.fotogrids-color-popover--open')
		).toBeNull();
	});

	it('shows a Locked badge from field state', () => {
		const { container } = mount(
			build({ key: 'c', label: 'L' }, '#000', false, {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
