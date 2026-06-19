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
	it('renders the selected unit and is closed initially', () => {
		const { container } = renderElement(build());
		expect(
			container.querySelector('.fotogrids-unit-select__value').textContent
		).toBe('px');
		expect(
			container.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});

	it('opens the dropdown on button click and lists options', () => {
		const { container } = renderElement(build());
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			container.querySelectorAll('.fotogrids-unit-select__option')
		).toHaveLength(3);
	});

	it('selects an option and fires onChange with a synthetic event', () => {
		const onChange = jest.fn();
		const { container } = renderElement(build({ onChange }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		const em = [
			...container.querySelectorAll('.fotogrids-unit-select__option'),
		].find((o) => o.textContent === 'em');
		click(em);
		expect(onChange).toHaveBeenCalledWith({ target: { value: 'em' } });
	});

	it('does not open when disabled', () => {
		const { container } = renderElement(build({ disabled: true }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			container.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});

	it('marks the currently selected option', () => {
		const { container } = renderElement(build({ value: 'em' }));
		click(container.querySelector('.fotogrids-unit-select__button'));
		expect(
			container.querySelector(
				'.fotogrids-unit-select__option.fg-is-selected'
			).textContent
		).toBe('em');
	});

	it('closes on outside mousedown', () => {
		const { container } = renderElement(build());
		click(container.querySelector('.fotogrids-unit-select__button'));
		act(() => {
			document.dispatchEvent(
				new window.MouseEvent('mousedown', { bubbles: true })
			);
		});
		expect(
			container.querySelector('.fotogrids-unit-select__dropdown')
		).toBeNull();
	});
});
