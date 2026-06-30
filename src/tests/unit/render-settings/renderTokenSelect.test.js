/**
 * Tests for renderTokenSelect.js (multi-select chips + dropdown)
 */
import '@/admin/plain/render-settings/renderTokenSelect';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;

const OPTIONS = [
	{ value: 'caption', label: 'Caption' },
	{ value: 'exif', label: 'EXIF' },
	{ value: 'tags', label: 'Tags' },
];

const build = (currentValue, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderTokenSelect(
		{ key: 'fields', label: 'Fields', options: OPTIONS },
		currentValue,
		disabled,
		{ updateSetting: jest.fn(), renderIcon, __, ...deps }
	);

describe('renderTokenSelect', () => {
	let mounted = [];
	const mount = (el) => {
		const h = renderElement(el);
		mounted.push(h);
		return h;
	};
	afterEach(() => {
		mounted.forEach((h) => h.unmount());
		mounted = [];
	});

	const open = (container) =>
		click(container.querySelector('.fotogrids-token-select__input'));

	it('parses a JSON array value into chips', () => {
		const { container } = mount(build('["caption","exif"]', false));
		expect(
			container.querySelectorAll('.fotogrids-token-select__token')
		).toHaveLength(2);
	});

	it('parses a legacy comma-string value into chips', () => {
		const { container } = mount(build('caption,tags', false));
		expect(
			container.querySelectorAll('.fotogrids-token-select__token')
		).toHaveLength(2);
	});

	it('shows a placeholder when nothing is selected', () => {
		const { container } = mount(build('[]', false));
		expect(
			container.querySelector('.fotogrids-token-select__placeholder')
		).not.toBeNull();
	});

	it('opens the dropdown listing all options', () => {
		const { container } = mount(build('[]', false));
		open(container);
		expect(
			document.querySelectorAll('.fotogrids-token-select__option')
		).toHaveLength(3);
	});

	it('adds an option on click and serializes the new value', () => {
		const updateSetting = jest.fn();
		const { container } = mount(build('[]', false, { updateSetting }));
		open(container);
		const caption = [
			...document.querySelectorAll('.fotogrids-token-select__option'),
		].find((o) => o.textContent.includes('Caption'));
		click(caption);
		expect(updateSetting).toHaveBeenCalledWith(
			'fields',
			JSON.stringify(['caption'])
		);
	});

	it('marks already-selected options in the dropdown', () => {
		const { container } = mount(build('["exif"]', false));
		open(container);
		expect(
			document.querySelector(
				'.fotogrids-token-select__option--selected'
			).textContent
		).toContain('EXIF');
	});

	it('removes a chip via its remove button', () => {
		const updateSetting = jest.fn();
		const { container } = mount(
			build('["caption","exif"]', false, { updateSetting })
		);
		const remove = container.querySelector(
			'.fotogrids-token-select__token-remove'
		);
		click(remove);
		expect(updateSetting).toHaveBeenCalled();
		const lastArg = updateSetting.mock.calls.at(-1)[1];
		expect(JSON.parse(lastArg)).not.toContain('caption');
	});

	it('does not open when disabled', () => {
		const { container } = mount(build('[]', true));
		open(container);
		expect(
			document.querySelector('.fotogrids-token-select__option')
		).toBeNull();
	});

	it('filters global-default options in defaults mode', () => {
		const { container } = mount(
			window.FotoGridsRenderSettings.renderTokenSelect(
				{
					key: 'fields',
					options: [
						{ value: 'a', label: 'A' },
						{ value: 'inherit', label: 'I', isGlobalDefault: true },
					],
				},
				'[]',
				false,
				{ updateSetting: jest.fn(), renderIcon, __, isDefaultsMode: true }
			)
		);
		open(container);
		expect(
			document.querySelectorAll('.fotogrids-token-select__option')
		).toHaveLength(1);
	});

	it('closes the dropdown on Escape', () => {
		const { container } = mount(build('[]', false));
		open(container);
		expect(
			document.querySelector('.fotogrids-token-select__option')
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
			document.querySelector('.fotogrids-token-select__option')
		).toBeNull();
	});

	it('closes the dropdown on outside mousedown', () => {
		const { container } = mount(build('[]', false));
		open(container);
		act(() => {
			document.body.dispatchEvent(
				new window.MouseEvent('mousedown', { bubbles: true })
			);
		});
		expect(
			document.querySelector('.fotogrids-token-select__option')
		).toBeNull();
	});

	it('opens via keyboard (Enter) on the trigger', () => {
		const { container } = mount(build('[]', false));
		const trigger = container.querySelector(
			'.fotogrids-token-select__input'
		);
		act(() => {
			trigger.dispatchEvent(
				new window.KeyboardEvent('keydown', {
					key: 'Enter',
					bubbles: true,
				})
			);
		});
		expect(
			document.querySelector('.fotogrids-token-select__option')
		).not.toBeNull();
	});

	describe('sortable mode', () => {
		const buildSortable = (value, deps = {}) =>
			window.FotoGridsRenderSettings.renderTokenSelect(
				{
					key: 'fields',
					label: 'Fields',
					options: OPTIONS,
					sortable: true,
				},
				value,
				false,
				{ updateSetting: jest.fn(), renderIcon, __, ...deps }
			);

		const fireDrag = (node, type, dataTransfer = {}) => {
			act(() => {
				const ev = new window.Event(type, { bubbles: true });
				ev.dataTransfer = {
					setData: jest.fn(),
					getData: jest.fn(),
					...dataTransfer,
				};
				node.dispatchEvent(ev);
			});
		};

		it('renders draggable tokens with drag handles', () => {
			const { container } = mount(buildSortable('["caption","exif"]'));
			const token = container.querySelector(
				'.fotogrids-token-select__token--sortable'
			);
			expect(token).not.toBeNull();
			expect(token.getAttribute('draggable')).toBe('true');
			expect(
				container.querySelector('.fotogrids-token-select__token-drag')
			).not.toBeNull();
		});

		it('reorders tokens through a drag start/over/drop/end sequence', () => {
			const updateSetting = jest.fn();
			const { container } = mount(
				buildSortable('["caption","exif","tags"]', { updateSetting })
			);
			const tokens = container.querySelectorAll(
				'.fotogrids-token-select__token--sortable'
			);
			expect(tokens.length).toBe(3);
			fireDrag(tokens[0], 'dragstart');
			fireDrag(tokens[2], 'dragover');
			fireDrag(tokens[2], 'drop');
			fireDrag(tokens[2], 'dragend');
			// a reorder commits the new value
			expect(updateSetting).toHaveBeenCalled();
		});
	});
});
