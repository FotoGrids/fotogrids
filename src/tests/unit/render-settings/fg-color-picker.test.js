/**
 * Tests for render-settings/utils/fg-color-picker.js (window.FGColorPicker.create)
 *
 * jsdom has no canvas, so getContext('2d') is stubbed with a minimal 2D context.
 */
import '@/admin/plain/render-settings/utils/fg-color-picker';

function stubCanvas() {
	const grad = { addColorStop: jest.fn() };
	const ctx = {
		createLinearGradient: jest.fn(() => grad),
		fillRect: jest.fn(),
		set fillStyle(v) {},
		get fillStyle() {
			return '';
		},
	};
	jest.spyOn(
		window.HTMLCanvasElement.prototype,
		'getContext'
	).mockReturnValue(ctx);
	return ctx;
}

function dragCanvas(picker, x, y) {
	const wrap = picker.element.querySelector('.fg-cp__canvas-wrap');
	jest.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		top: 0,
		width: 264,
		height: 160,
	});
	const canvas = picker.element.querySelector('.fg-cp__canvas');
	canvas.dispatchEvent(
		new window.MouseEvent('mousedown', {
			bubbles: true,
			clientX: x,
			clientY: y,
		})
	);
}

describe('FGColorPicker', () => {
	let ctx;

	beforeEach(() => {
		ctx = stubCanvas();
		document.head.innerHTML = '';
	});

	afterEach(() => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
		document.head.innerHTML = '';
	});

	it('builds a widget element and draws the canvas', () => {
		const picker = window.FGColorPicker.create({
			value: '#ff0000',
			onChange: jest.fn(),
		});
		expect(picker.element.classList.contains('fg-cp')).toBe(true);
		expect(picker.element.querySelector('.fg-cp__canvas')).not.toBeNull();
		expect(ctx.createLinearGradient).toHaveBeenCalled();
		// injects a per-instance <style> tag in <head>
		expect(document.head.querySelector('style[data-fg-cp]')).not.toBeNull();
	});

	it('falls back to black when the initial value is unparseable', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'not-a-color',
			onChange,
		});
		const text = picker.element.querySelector('.fg-cp__text-input');
		// default format is RGBA, default state is black opaque
		expect(text.value).toBe('rgba(0, 0, 0, 1)');
	});

	it('parses hex, rgba and hsla input values', () => {
		const cases = [
			['#00FF00', 'rgba(0, 255, 0, 1)'],
			['rgba(10, 20, 30, 0.5)', 'rgba(10, 20, 30, 0.5)'],
			['hsla(0, 0%, 100%, 1)', 'rgba(255, 255, 255, 1)'],
		];
		for (const [input, expected] of cases) {
			const picker = window.FGColorPicker.create({ value: input });
			expect(
				picker.element.querySelector('.fg-cp__text-input').value
			).toBe(expected);
		}
	});

	it('emits a CSS color string when the hue slider changes', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'rgba(255, 0, 0, 1)',
			onChange,
		});
		const hue = picker.element.querySelector('.fg-cp__slider--hue');
		hue.value = '120';
		hue.dispatchEvent(new window.Event('input', { bubbles: true }));
		expect(onChange).toHaveBeenCalled();
		expect(onChange.mock.calls.at(-1)[0]).toMatch(/^rgba\(/);
	});

	it('emits when the alpha slider changes', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'rgba(255, 0, 0, 1)',
			onChange,
		});
		const alpha = picker.element.querySelector('.fg-cp__slider--alpha');
		alpha.value = '50';
		alpha.dispatchEvent(new window.Event('input', { bubbles: true }));
		expect(onChange.mock.calls.at(-1)[0]).toContain('0.5');
	});

	it('switches the text format between HEX, RGBA and HSLA', () => {
		const picker = window.FGColorPicker.create({ value: '#3366CC' });
		const buttons = picker.element.querySelectorAll('.fg-cp__format-btn');
		const text = picker.element.querySelector('.fg-cp__text-input');

		const hexBtn = [...buttons].find((b) => b.textContent === 'HEX');
		hexBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		expect(text.value.startsWith('#')).toBe(true);

		const hslaBtn = [...buttons].find((b) => b.textContent === 'HSLA');
		hslaBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		expect(text.value.startsWith('hsla(')).toBe(true);
	});

	it('accepts a valid typed color and ignores an invalid one', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'rgba(0,0,0,1)',
			onChange,
		});
		const text = picker.element.querySelector('.fg-cp__text-input');

		text.value = 'rgba(255, 128, 0, 1)';
		text.dispatchEvent(new window.Event('change', { bubbles: true }));
		expect(onChange).toHaveBeenCalled();

		onChange.mockClear();
		const before = text.value;
		text.value = 'garbage';
		text.dispatchEvent(new window.Event('change', { bubbles: true }));
		// invalid input resets the field, no emit
		expect(onChange).not.toHaveBeenCalled();
		expect(text.value).toBe(before);
	});

	it('setValue updates the displayed color and ignores bad input', () => {
		const picker = window.FGColorPicker.create({ value: '#000000' });
		const text = picker.element.querySelector('.fg-cp__text-input');
		picker.setValue('rgba(1, 2, 3, 1)');
		expect(text.value).toBe('rgba(1, 2, 3, 1)');
		picker.setValue('nope');
		expect(text.value).toBe('rgba(1, 2, 3, 1)');
	});

	it('updates saturation/value on a canvas drag and emits', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'rgba(255, 0, 0, 1)',
			onChange,
		});
		dragCanvas(picker, 132, 80);
		expect(onChange).toHaveBeenCalled();
	});

	it('disabled pickers do not emit on canvas drag', () => {
		const onChange = jest.fn();
		const picker = window.FGColorPicker.create({
			value: 'rgba(255, 0, 0, 1)',
			onChange,
			disabled: true,
		});
		expect(picker.element.classList.contains('fg-cp--disabled')).toBe(true);
		dragCanvas(picker, 132, 80);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('destroy removes the element and its style tag', () => {
		const picker = window.FGColorPicker.create({ value: '#000000' });
		document.body.appendChild(picker.element);
		picker.destroy();
		expect(document.body.querySelector('.fg-cp')).toBeNull();
		expect(document.head.querySelector('style[data-fg-cp]')).toBeNull();
	});
});
