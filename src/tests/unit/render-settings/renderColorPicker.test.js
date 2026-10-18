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
		expect(
			container.querySelector('input.fotogrids-color-text').value
		).toBe('#ff0000');
	});

	it('falls back to the default colour when value is empty', () => {
		const { container } = mount(
			build({ key: 'c', default: '#123456' }, '', false)
		);
		expect(
			container.querySelector('input.fotogrids-color-text').value
		).toBe('#123456');
	});

	it('renders an unset swatch (not black) when value and default are both empty', () => {
		const { container } = mount(build({ key: 'c' }, '', false));
		const fill = container.querySelector('.fotogrids-color-swatch__fill');
		const text = container.querySelector('input.fotogrids-color-text');
		expect(fill.classList).toContain('fotogrids-color-swatch__fill--unset');
		expect(fill.style.background).toBe('');
		expect(text.value).toBe('');
		expect(text.placeholder).toBe('Default');
	});

	it('opens a popover with the FGColorPicker widget on swatch click', () => {
		const { container } = mount(build({ key: 'c' }, '#000000', false));
		click(container.querySelector('.fotogrids-color-swatch'));
		const popover = document.querySelector(
			'.fotogrids-color-popover--open'
		);
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

	it('offers Reset when the value differs from the collection default, and writes the default back', () => {
		const updateSetting = jest.fn();
		const { container } = mount(
			build(
				{ key: 'caption_title_color' },
				'rgba(200, 30, 30, 1)',
				false,
				{
					updateSetting,
					defaultValue: '',
				}
			)
		);
		const reset = container.querySelector('.fotogrids-color-picker__reset');
		expect(reset).not.toBeNull();
		click(reset);
		expect(updateSetting).toHaveBeenCalledWith('caption_title_color', '');
	});

	it('prefers the field default over the collection default for Reset', () => {
		const updateSetting = jest.fn();
		const { container } = mount(
			build({ key: 'c', default: '#123456' }, '#ff0000', false, {
				updateSetting,
				defaultValue: '#000000',
			})
		);
		click(container.querySelector('.fotogrids-color-picker__reset'));
		expect(updateSetting).toHaveBeenCalledWith('c', '#123456');
	});

	it('offers no Reset when the value is the default, is unset, or the field is disabled', () => {
		const at = mount(
			build({ key: 'c' }, 'rgba(0, 0, 0, 0.3)', false, {
				defaultValue: 'rgba(0, 0, 0, 0.3)',
			})
		);
		const unset = mount(
			build({ key: 'c' }, '', false, { defaultValue: '' })
		);
		const disabled = mount(
			build({ key: 'c' }, '#ff0000', true, { defaultValue: '' })
		);
		for (const { container } of [at, unset, disabled]) {
			expect(
				container.querySelector('.fotogrids-color-picker__reset')
			).toBeNull();
		}
	});

	it('renders the field description', () => {
		const { container } = mount(
			build(
				{
					key: 'c',
					label: 'Title Color',
					description: 'When not set, white.',
				},
				'',
				false
			)
		);
		expect(
			container.querySelector('.fotogrids-setting__description')
				.textContent
		).toBe('When not set, white.');
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
