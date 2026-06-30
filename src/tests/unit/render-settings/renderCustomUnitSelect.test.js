/**
 * Tests for renderCustomUnitSelect.js (window.FotoGridsRenderSettings.CustomUnitSelect)
 */
import '@/admin/plain/render-settings/renderCustomUnitSelect';
import { renderElement, click, act } from '@tests/helpers/render-component';

const OPTIONS = [
	{ value: 'px', label: 'px' },
	{ value: 'em', label: 'em' },
	{ value: '%', label: '%' },
];

const build = (props) =>
	wp.element.createElement(
		window.FotoGridsRenderSettings.CustomUnitSelect,
		{ value: 'px', options: OPTIONS, onChange: jest.fn(), ...props }
	);

describe('CustomUnitSelect', () => {
	// The dropdown is rendered through a portal into document.body, so it
	// must be queried from the document, not the mount container. Track each
	// mount and unmount it after the test so React removes its own portal
	// nodes (clearing document.body directly corrupts React's bookkeeping).
	let mounts = [];
	const mountTest = (element) => {
		const result = renderElement(element);
		mounts.push(result);
		return result;
	};

	afterEach(() => {
		mounts.forEach((m) => m.unmount());
		mounts = [];
	});

	it('renders the selected unit and is closed initially', () => {
		const { container } = mountTest(build());
		expect(
			container.querySelector('.fotogrids-unit-select__value').textContent
		).toBe('px');
		expect(
			document.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});

	it('opens the dropdown on button click and lists options', () => {
		const { container } = mountTest(build());
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			document.querySelectorAll('.fotogrids-unit-select__option')
		).toHaveLength(3);
	});

	it('selects an option and fires onChange with a synthetic event', () => {
		const onChange = jest.fn();
		const { container } = mountTest(build({ onChange }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		const em = [
			...document.querySelectorAll('.fotogrids-unit-select__option'),
		].find((o) => o.textContent === 'em');
		click(em);
		expect(onChange).toHaveBeenCalledWith({ target: { value: 'em' } });
	});

	it('does not open when disabled', () => {
		const { container } = mountTest(build({ disabled: true }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			document.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});

	it('marks the currently selected option', () => {
		const { container } = mountTest(build({ value: 'em' }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			document.querySelector(
				'.fotogrids-unit-select__option.fg-is-selected'
			).textContent
		).toBe('em');
	});

	it('closes on outside mousedown', () => {
		const { container } = mountTest(build());
		click(container.querySelector('.fotogrids-unit-select__button'));
		act(() => {
			document.dispatchEvent(
				new window.MouseEvent('mousedown', { bubbles: true })
			);
		});
		expect(
			document.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});
});
