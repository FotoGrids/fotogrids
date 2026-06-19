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
});
