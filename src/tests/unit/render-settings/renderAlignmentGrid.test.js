/**
 * Tests for renderAlignmentGrid.js (delegates to renderButtonGroup)
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderAlignmentGrid';
import { renderElement } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (setting, value, disabled, deps = {}) =>
	window.FotoGridsRenderSettings.renderAlignmentGrid(
		setting,
		value,
		disabled,
		{ updateSetting: jest.fn(), renderIcon: (n) => n, __, ...deps }
	);

describe('renderAlignmentGrid', () => {
	it('lays out a 3x3 grid with the alignment-grid class', () => {
		const options = [
			{ value: 'top-left', label: 'TL' },
			{ value: 'center', label: 'C' },
			{ value: 'bottom-right', label: 'BR' },
		];
		const { container } = renderElement(
			build({ key: 'align', options }, 'center', false)
		);
		expect(
			container.querySelector('.fotogrids-alignment-grid')
		).not.toBeNull();
		// always 9 cells (missing ones become empty slots)
		const cells = container.querySelectorAll(
			'.fg-button-group__button, .fg-button-group__button--empty'
		);
		expect(cells).toHaveLength(9);
	});

	it('renders a sparse grid in defaults mode without throwing', () => {
		const options = [
			{ value: 'top-left', label: 'TL' },
			{ value: 'center', label: 'C' },
			{ value: 'bottom-right', label: 'BR' },
		];
		const { container } = renderElement(
			build({ key: 'align', options }, 'center', false, {
				isDefaultsMode: true,
			})
		);
		// empty slots must survive the defaults-mode isGlobalDefault filter
		const cells = container.querySelectorAll(
			'.fg-button-group__button, .fg-button-group__button--empty'
		);
		expect(cells).toHaveLength(9);
	});

	it('drops isGlobalDefault options in defaults mode, keeping the slot empty', () => {
		const options = [
			{ value: 'top-left', label: 'TL' },
			{ value: 'center', label: 'C', isGlobalDefault: true },
			{ value: 'bottom-right', label: 'BR' },
		];
		const { container } = renderElement(
			build({ key: 'align', options }, 'top-left', false, {
				isDefaultsMode: true,
			})
		);
		expect(
			container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(2);
		expect(
			container.querySelectorAll('.fg-button-group__button--empty')
		).toHaveLength(7);
	});

	it('maps options into their grid positions, leaving gaps empty', () => {
		const options = [
			{ value: 'center', label: 'C' },
			{ value: 'top-left', label: 'TL' },
		];
		const { container } = renderElement(
			build({ key: 'align', options }, 'center', false)
		);
		// two real buttons placed, seven empty slots
		expect(
			container.querySelectorAll('.fg-button-group__button')
		).toHaveLength(2);
		expect(
			container.querySelectorAll('.fg-button-group__button--empty')
		).toHaveLength(7);
	});

	describe('the nine catalog cells (icon only)', () => {
		const CATALOG = [
			['top-left', 'Top left'],
			['top-center', 'Top centre'],
			['top-right', 'Top right'],
			['center-left', 'Centre left'],
			['center', 'Centre'],
			['center-right', 'Centre right'],
			['bottom-left', 'Bottom left'],
			['bottom-center', 'Bottom centre'],
			['bottom-right', 'Bottom right'],
		];
		const options = CATALOG.map(([value]) => ({
			value,
			icon: `dots_grid_${value.replace('-', '_')}`,
		}));

		it('names every cell, in grid order, by aria-label and title', () => {
			const { container } = renderElement(
				build({ key: 'align', options }, 'center', false)
			);
			const buttons = container.querySelectorAll(
				'.fg-button-group__button'
			);
			expect(buttons).toHaveLength(9);
			buttons.forEach((button, index) => {
				expect(button.getAttribute('aria-label')).toBe(
					CATALOG[index][1]
				);
				expect(button.getAttribute('title')).toBe(CATALOG[index][1]);
			});
		});

		it.each(CATALOG.map(([value]) => value))(
			'announces only %s as pressed when it is the value',
			(value) => {
				const { container } = renderElement(
					build({ key: 'align', options }, value, false)
				);
				const pressed = container.querySelectorAll(
					'.fg-button-group__button[aria-pressed="true"]'
				);
				expect(pressed).toHaveLength(1);
				expect(pressed[0].getAttribute('aria-label')).toBe(
					CATALOG.find(([v]) => v === value)[1]
				);
				expect(
					container.querySelectorAll(
						'.fg-button-group__button[aria-pressed="false"]'
					)
				).toHaveLength(8);
			}
		);

		it('translates the cell names through __', () => {
			const translate = jest.fn((t) => `tr:${t}`);
			const { container } = renderElement(
				build({ key: 'align', options }, 'center', false, {
					__: translate,
				})
			);
			expect(translate).toHaveBeenCalledWith('Top left', 'fotogrids');
			expect(
				container
					.querySelector('.fg-button-group__button')
					.getAttribute('aria-label')
			).toBe('tr:Top left');
		});
	});

	it('keeps an option label as the name when the catalog gives one', () => {
		const { container } = renderElement(
			build(
				{ key: 'align', options: [{ value: 'top-left', label: 'TL' }] },
				'top-left',
				false
			)
		);
		const button = container.querySelector('.fg-button-group__button');
		expect(button.getAttribute('aria-label')).toBe('TL');
		expect(button.getAttribute('title')).toBe('TL');
	});
});
