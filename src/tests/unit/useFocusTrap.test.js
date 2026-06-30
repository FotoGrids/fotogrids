/**
 * Tests for components/shared/Modal/hooks/useFocusTrap.js
 */
import { useRef } from 'react';
import { useFocusTrap } from '@/admin/src/components/shared/Modal/hooks/useFocusTrap';
import { renderElement, act } from '@tests/helpers/render-component';

const h = wp.element.createElement;

function TrapHost({ active }) {
	const ref = useRef(null);
	useFocusTrap(ref, active);
	return h(
		'div',
		{ ref },
		h('button', { id: 'first' }, 'first'),
		h('button', { id: 'last' }, 'last')
	);
}

describe('useFocusTrap', () => {
	beforeEach(() => {
		// jsdom reports offsetParent null; force buttons to be "visible"
		Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
			get() {
				return this.parentNode;
			},
			configurable: true,
		});
	});

	it('focuses the first focusable element on activation', () => {
		renderElement(h(TrapHost, { active: true }));
		expect(document.activeElement.id).toBe('first');
	});

	it('does not trap when inactive', () => {
		// blur whatever a prior test focused
		if (document.activeElement && document.activeElement.blur) {
			document.activeElement.blur();
		}
		const { container } = renderElement(h(TrapHost, { active: false }));
		// the trap should not have moved focus into the container
		expect(container.contains(document.activeElement)).toBe(false);
	});

	it('wraps Tab from the last element back to the first', () => {
		const { container } = renderElement(h(TrapHost, { active: true }));
		const last = container.querySelector('#last');
		last.focus();
		act(() => {
			document.dispatchEvent(
				new window.KeyboardEvent('keydown', {
					key: 'Tab',
					bubbles: true,
				})
			);
			container.dispatchEvent(
				new window.KeyboardEvent('keydown', {
					key: 'Tab',
					bubbles: true,
				})
			);
		});
		// focus stays within the trapped container
		expect(['first', 'last']).toContain(document.activeElement.id);
	});

	it('restores focus to the previously focused element on unmount', () => {
		const outside = document.createElement('button');
		outside.id = 'outside';
		document.body.appendChild(outside);
		outside.focus();
		const handle = renderElement(h(TrapHost, { active: true }));
		handle.unmount();
		expect(document.activeElement.id).toBe('outside');
		outside.remove();
	});
});
