/**
 * Tests for renderSelect.js (stateful portal dropdown)
 */
import '@/admin/plain/render-settings/renderSelect';
import {
	renderElement,
	click,
	changeValue,
	act,
} from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => `icon:${n}`;

// Stable references: the component memoises position off topOptions/groups
// identity, so inline arrays per render would loop. Callers reuse these.
const DEFAULT_SETTING = { key: 'k', label: 'Pick' };
const DEFAULT_SELECTED = { value: 'a', label: 'Option A' };
const DEFAULT_TOP = [
	{ value: 'a', label: 'Option A' },
	{ value: 'b', label: 'Option B' },
];
const EMPTY = [];

const build = (config) =>
	window.FotoGridsRenderSettings.renderSelect({
		setting: DEFAULT_SETTING,
		selectedOption: DEFAULT_SELECTED,
		topOptions: DEFAULT_TOP,
		groups: EMPTY,
		renderIcon,
		__,
		...config,
	});

const openDropdown = (container) =>
	click(container.querySelector('.fotogrids-render-select__trigger'));

describe('renderSelect', () => {
	let mounted = [];
	const mount = (el) => {
		const handle = renderElement(el);
		mounted.push(handle);
		return handle;
	};

	afterEach(() => {
		// Unmount React roots (clears their portals) before the next test.
		mounted.forEach((h) => h.unmount());
		mounted = [];
	});

	it('renders the trigger with the selected label and is closed initially', () => {
		const { container } = mount(build());
		expect(
			container.querySelector('.fotogrids-render-select__selected')
				.textContent
		).toBe('Option A');
		expect(
			document.querySelector('.fotogrids-render-select__dropdown')
		).toBeNull();
	});

	it('opens the dropdown and lists options on trigger click', () => {
		const { container } = mount(build());
		openDropdown(container);
		const options = document.querySelectorAll(
			'.fotogrids-render-select__option'
		);
		expect(options).toHaveLength(2);
		expect(
			container.querySelector('.fotogrids-render-select--is-open')
		).not.toBeNull();
	});

	it('marks the selected option', () => {
		const { container } = mount(build());
		openDropdown(container);
		const selected = document.querySelector(
			'.fotogrids-render-select__option.is-selected'
		);
		expect(selected.textContent).toBe('Option A');
	});

	it('calls onSelect and closes when an option is clicked', () => {
		const onSelect = jest.fn();
		const { container } = mount(build({ onSelect }));
		openDropdown(container);
		const optB = [
			...document.querySelectorAll('.fotogrids-render-select__option'),
		].find((b) => b.textContent === 'Option B');
		click(optB);
		expect(onSelect).toHaveBeenCalledWith(
			'b',
			expect.objectContaining({ value: 'b' })
		);
		expect(
			document.querySelector('.fotogrids-render-select__dropdown')
		).toBeNull();
	});

	it('does not open when disabled', () => {
		const { container } = mount(build({ isDisabled: true }));
		openDropdown(container);
		expect(
			document.querySelector('.fotogrids-render-select__dropdown')
		).toBeNull();
	});

	it('renders grouped options with labels and statuses', () => {
		const groups = [
			{
				id: 'g1',
				label: 'Group 1',
				options: [{ value: 'x', label: 'X' }],
				status: 'Loading…',
			},
		];
		const { container } = mount(
			build({ topOptions: EMPTY, groups })
		);
		openDropdown(container);
		expect(
			document.querySelector('.fotogrids-render-select__group-label')
				.textContent
		).toBe('Group 1');
		expect(
			document.querySelector('.fotogrids-render-select__status').textContent
		).toBe('Loading…');
	});

	it('renders a search box and forwards term changes when searchEnabled', () => {
		const onSearchTermChange = jest.fn();
		const { container } = mount(
			build({ searchEnabled: true, onSearchTermChange })
		);
		openDropdown(container);
		const input = document.querySelector(
			'.fotogrids-render-select__search-input'
		);
		expect(input).not.toBeNull();
		changeValue(input, 'foo');
		expect(onSearchTermChange).toHaveBeenCalledWith('foo');
	});

	it('closes on Escape', () => {
		const { container } = mount(build());
		openDropdown(container);
		expect(
			document.querySelector('.fotogrids-render-select__dropdown')
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
			document.querySelector('.fotogrids-render-select__dropdown')
		).toBeNull();
	});

	it('closes on outside mousedown', () => {
		const { container } = mount(build());
		openDropdown(container);
		act(() => {
			document.body.dispatchEvent(
				new window.MouseEvent('mousedown', { bubbles: true })
			);
		});
		expect(
			document.querySelector('.fotogrids-render-select__dropdown')
		).toBeNull();
	});

	it('shows a pro badge from field state', () => {
		const { container } = mount(
			build({ getFieldState: () => 'locked' })
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});

	it('uses a custom option label renderer', () => {
		const { container } = mount(
			build({
				renderOptionLabel: (o) => `[${o.label}]`,
			})
		);
		openDropdown(container);
		expect(
			document.querySelector('.fotogrids-render-select__option').textContent
		).toBe('[Option A]');
	});
});
