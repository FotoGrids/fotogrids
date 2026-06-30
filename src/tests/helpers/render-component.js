/**
 * Lightweight render helper for the plain render-settings components.
 *
 * These modules attach factory functions to window.FotoGridsRenderSettings and
 * return wp.element (React) elements. @testing-library/react is not installed,
 * so this helper drives react-dom's createRoot under act() directly.
 */
import { createRoot } from 'react-dom/client';
import { act } from 'react';

/**
 * Mount a React element into a detached container and return helpers.
 *
 * @param {*} element React element (e.g. the return of a renderX factory).
 * @returns {{ container: HTMLElement, unmount: () => void, rerender: (el:*) => void }}
 */
export function renderElement(element) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(element);
	});

	return {
		container,
		rerender(next) {
			act(() => {
				root.render(next);
			});
		},
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

export { act };

/**
 * Fire a click on a node inside act().
 *
 * @param {Element} node
 */
export function click(node) {
	act(() => {
		node.dispatchEvent(
			new window.MouseEvent('click', { bubbles: true, cancelable: true })
		);
	});
}

/**
 * Dispatch a bubbling mouse event of `type` on `node` inside act().
 * React 18 delegates onMouseEnter/onMouseLeave off native mouseover/mouseout.
 *
 * @param {Element} node
 * @param {string} type e.g. 'mouseover', 'mouseout'
 */
export function fireMouse(node, type) {
	act(() => {
		node.dispatchEvent(
			new window.MouseEvent(type, { bubbles: true, cancelable: true })
		);
	});
}

/**
 * Set a form-control value via the native prototype setter (so React's
 * controlled-input change detection fires) and dispatch input + change
 * events inside act(). Works for input, textarea and select.
 *
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} node
 * @param {string} value
 */
export function changeValue(node, value) {
	const proto =
		node instanceof window.HTMLSelectElement
			? window.HTMLSelectElement.prototype
			: node instanceof window.HTMLTextAreaElement
				? window.HTMLTextAreaElement.prototype
				: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
	act(() => {
		setter.call(node, value);
		node.dispatchEvent(new window.Event('input', { bubbles: true }));
		node.dispatchEvent(new window.Event('change', { bubbles: true }));
	});
}
