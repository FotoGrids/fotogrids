/**
 * Shared helpers for the walkthrough tests.
 */

/**
 * Give an element a layout box, which jsdom does not compute.
 *
 * @param {Element} el     Element.
 * @param {Object}  [rect] Rect values.
 * @returns {Element}
 */
export const layout = (el, rect = {}) => {
	const box = { top: 100, left: 100, width: 120, height: 32, ...rect };
	el.getBoundingClientRect = () => ({
		...box,
		right: box.left + box.width,
		bottom: box.top + box.height,
		x: box.left,
		y: box.top,
	});
	return el;
};

/**
 * Append a laid-out element to the body.
 *
 * @param {string} html Markup with one root element.
 * @returns {Element}
 */
export const addEl = (html) => {
	const wrap = document.createElement('div');
	wrap.innerHTML = html.trim();
	const el = wrap.firstElementChild;
	document.body.appendChild(el);
	return layout(el);
};
