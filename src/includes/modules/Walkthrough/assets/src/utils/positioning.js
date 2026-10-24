/**
 * Placement of a walkthrough step bubble next to its target.
 *
 * All coordinates are viewport (position: fixed) pixels.
 */

export const GAP = 12;
export const MARGIN = 16;
export const MAX_WIDTH = 360;

/**
 * Bubble width for a viewport: never wider than the viewport minus margins.
 *
 * @param {number} viewportWidth Viewport width.
 * @returns {number}
 */
export const bubbleWidth = (viewportWidth) =>
	Math.max(0, Math.min(MAX_WIDTH, viewportWidth - MARGIN * 2));

const clamp = (value, min, max) =>
	Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where the bubble goes: below the target when it fits, else above, else the
 * side with more room. The bubble lines up with the target's start edge (left
 * in LTR, right in RTL) and is kept inside the viewport.
 *
 * @param {Object}  args
 * @param {{top:number,left:number,width:number,height:number}} args.target   Target rect.
 * @param {{width:number,height:number}}                        args.bubble   Bubble size.
 * @param {{width:number,height:number,top?:number}}            args.viewport Viewport size; `top` is space taken by fixed chrome (the admin bar).
 * @param {boolean}                                             [args.rtl]    Right-to-left layout.
 * @returns {{placement:'below'|'above',top:number,left:number,arrow:number}}
 */
export const computePosition = ({ target, bubble, viewport, rtl = false }) => {
	const topLimit = (viewport.top || 0) + MARGIN;
	const bottomLimit = viewport.height - MARGIN;
	const roomBelow = bottomLimit - (target.top + target.height + GAP);
	const roomAbove = target.top - GAP - topLimit;

	let placement = 'below';
	if (roomBelow < bubble.height && roomAbove >= bubble.height) {
		placement = 'above';
	} else if (roomBelow < bubble.height && roomAbove < bubble.height) {
		placement = roomAbove > roomBelow ? 'above' : 'below';
	}

	const rawTop =
		placement === 'below'
			? target.top + target.height + GAP
			: target.top - GAP - bubble.height;
	const top = clamp(rawTop, topLimit, bottomLimit - bubble.height);

	const rawLeft = rtl
		? target.left + target.width - bubble.width
		: target.left;
	const left = clamp(rawLeft, MARGIN, viewport.width - MARGIN - bubble.width);

	const targetCenter = target.left + target.width / 2;
	const arrow = clamp(targetCenter - left, 16, bubble.width - 16);

	return { placement, top, left, arrow };
};
