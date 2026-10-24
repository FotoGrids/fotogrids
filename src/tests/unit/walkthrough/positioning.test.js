/**
 * Walkthrough bubble placement.
 */
import {
	bubbleWidth,
	computePosition,
	GAP,
	MARGIN,
	MAX_WIDTH,
} from '@modules/Walkthrough/assets/src/utils/positioning';

const viewport = { width: 1200, height: 800, top: 32 };
const bubble = { width: 320, height: 160 };

describe('bubbleWidth', () => {
	it('caps at the maximum on wide screens', () => {
		expect(bubbleWidth(1400)).toBe(MAX_WIDTH);
	});

	it('never exceeds the viewport minus margins', () => {
		expect(bubbleWidth(300)).toBe(300 - MARGIN * 2);
	});

	it('is never negative', () => {
		expect(bubbleWidth(10)).toBe(0);
	});
});

describe('computePosition', () => {
	it('places the bubble below the target, start-aligned', () => {
		const target = { top: 100, left: 200, width: 120, height: 30 };
		const pos = computePosition({ target, bubble, viewport });

		expect(pos.placement).toBe('below');
		expect(pos.top).toBe(100 + 30 + GAP);
		expect(pos.left).toBe(200);
		expect(pos.arrow).toBe(60);
	});

	it('flips above when there is no room below', () => {
		const target = { top: 700, left: 200, width: 100, height: 40 };
		const pos = computePosition({ target, bubble, viewport });

		expect(pos.placement).toBe('above');
		expect(pos.top).toBe(700 - GAP - bubble.height);
	});

	it('uses the roomier side when neither fits, and stays on screen', () => {
		const small = { width: 1200, height: 300, top: 0 };
		const target = { top: 200, left: 10, width: 50, height: 20 };
		const pos = computePosition({ target, bubble, viewport: small });

		expect(pos.placement).toBe('above');
		expect(pos.top).toBeGreaterThanOrEqual(MARGIN);
	});

	it('keeps clear of the admin bar', () => {
		const target = { top: 20, left: 100, width: 80, height: 10 };
		const pos = computePosition({
			target,
			bubble,
			viewport: { width: 1200, height: 140, top: 32 },
		});

		expect(pos.top).toBeGreaterThanOrEqual(32 + MARGIN);
	});

	it('aligns to the target end edge in RTL', () => {
		const target = { top: 100, left: 600, width: 200, height: 30 };
		const pos = computePosition({ target, bubble, viewport, rtl: true });

		expect(pos.left).toBe(600 + 200 - bubble.width);
	});

	it('clamps inside the viewport near the right edge', () => {
		const target = { top: 100, left: 1150, width: 40, height: 20 };
		const pos = computePosition({ target, bubble, viewport });

		expect(pos.left).toBe(viewport.width - MARGIN - bubble.width);
		expect(pos.arrow).toBeLessThanOrEqual(bubble.width - 16);
		expect(pos.arrow).toBeGreaterThanOrEqual(16);
	});
});
