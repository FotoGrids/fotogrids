/**
 * Tests for renderToggle.js
 */
import '@/admin/plain/render-settings/renderToggle';
import { renderElement, click } from '@tests/helpers/render-component';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const __ = (text) => text;

function build(setting, currentValue, isDisabled, deps = {}) {
	return window.FotoGridsRenderSettings.renderToggle(
		setting,
		currentValue,
		isDisabled,
		{ updateSetting: jest.fn(), getFieldState: undefined, __, ...deps }
	);
}

describe('renderToggle', () => {
	it('renders an unchecked switch by default', () => {
		const { container } = renderElement(
			build({ key: 'lazy', label: 'Lazy load' }, '0', false)
		);
		const btn = container.querySelector('button.fotogrids-toggle');
		expect(btn.getAttribute('aria-checked')).toBe('false');
		expect(btn.className).not.toContain('fgt-is-checked');
		expect(container.textContent).toContain('Lazy load');
	});

	it('renders a checked switch for value "1" and true', () => {
		const a = renderElement(build({ key: 'k', label: 'L' }, '1', false));
		expect(
			a.container
				.querySelector('button.fotogrids-toggle')
				.getAttribute('aria-checked')
		).toBe('true');

		const b = renderElement(build({ key: 'k', label: 'L' }, true, false));
		expect(
			b.container
				.querySelector('button.fotogrids-toggle')
				.className
		).toContain('fgt-is-checked');
	});

	it('calls updateSetting with the toggled value on click', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'lazy', label: 'L' }, '0', false, { updateSetting })
		);
		click(container.querySelector('button.fotogrids-toggle'));
		expect(updateSetting).toHaveBeenCalledWith('lazy', true);
	});

	it('does not call updateSetting when disabled', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(
			build({ key: 'lazy', label: 'L' }, '0', true, { updateSetting })
		);
		const btn = container.querySelector('button.fotogrids-toggle');
		expect(btn.disabled).toBe(true);
		click(btn);
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('shows a Locked badge when field state is locked', () => {
		const { container } = renderElement(
			build({ key: 'k', label: 'L' }, '0', false, {
				getFieldState: () => 'locked',
			})
		);
		expect(container.querySelector('.fotogrids-pro-badge').textContent).toBe(
			'Locked'
		);
	});

	it('shows a Pro badge for non-editable, non-locked state', () => {
		const { container } = renderElement(
			build({ key: 'k', label: 'L' }, '0', false, {
				getFieldState: () => 'pro',
			})
		);
		expect(container.querySelector('.fotogrids-pro-badge').textContent).toBe(
			'Pro'
		);
	});

	it('renders the description HTML when provided', () => {
		const { container } = renderElement(
			build(
				{ key: 'k', label: 'L', description: '<em>hi</em>' },
				'0',
				false
			)
		);
		expect(
			container.querySelector('.fotogrids-setting__description em')
				.textContent
		).toBe('hi');
	});
});
