/**
 * Walkthrough step resolution against the page.
 */
import {
	findTarget,
	isAvailable,
	isVisible,
	planSteps,
	revealTarget,
	waitFor,
} from '@modules/Walkthrough/assets/src/utils/steps';
import { addEl, layout } from './helpers';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isVisible', () => {
	it('is false for missing, detached or zero-size elements', () => {
		expect(isVisible(null)).toBe(false);
		expect(isVisible(document.createElement('div'))).toBe(false);
		const zero = document.createElement('div');
		document.body.appendChild(zero);
		expect(isVisible(zero)).toBe(false);
	});

	it('is false inside a hidden ancestor', () => {
		const parent = addEl('<div hidden><span id="t"></span></div>');
		layout(parent.querySelector('#t'));
		expect(isVisible(parent.querySelector('#t'))).toBe(false);
	});

	it('is true for a laid-out element', () => {
		expect(isVisible(addEl('<div id="t"></div>'))).toBe(true);
	});
});

describe('findTarget and isAvailable', () => {
	it('finds a visible target', () => {
		const el = addEl('<button id="t"></button>');
		expect(findTarget({ target: '#t' })).toBe(el);
		expect(isAvailable({ target: '#t' })).toBe(true);
	});

	it('returns a target inside a collapsed metabox so it can be expanded', () => {
		const box = addEl(
			'<div class="postbox closed"><div id="t"></div></div>'
		);
		expect(findTarget({ target: '#t' })).toBe(box.querySelector('#t'));
	});

	it('counts a step as available when only its revealer is on the page', () => {
		addEl('<button id="tab"></button>');
		expect(isAvailable({ target: '#t', reveal: '#tab' })).toBe(true);
		expect(isAvailable({ target: '#t', reveal: '#missing' })).toBe(false);
		expect(isAvailable({ target: '#t' })).toBe(false);
	});
});

describe('planSteps', () => {
	const steps = [
		{ id: 'a', target: '#a' },
		{ id: 'b', target: '#b' },
		{ id: 'place', part: 'place', target: '#place' },
	];

	it('drops unavailable steps and defers a missing place step', () => {
		addEl('<div id="a"></div>');
		const plan = planSteps(steps, { mode: 'full' });

		expect(plan.steps.map((s) => s.id)).toEqual(['a']);
		expect(plan.deferred).toBe(true);
	});

	it('runs every step in one go when the place target exists', () => {
		addEl('<div id="a"></div>');
		addEl('<div id="b"></div>');
		addEl('<div id="place"></div>');
		const plan = planSteps(steps, { mode: 'full' });

		expect(plan.steps.map((s) => s.id)).toEqual(['a', 'b', 'place']);
		expect(plan.deferred).toBe(false);
	});

	it('runs only the place part when resuming', () => {
		addEl('<div id="a"></div>');
		addEl('<div id="place"></div>');
		const plan = planSteps(steps, { mode: 'resume' });

		expect(plan.steps.map((s) => s.id)).toEqual(['place']);
		expect(plan.deferred).toBe(false);
	});

	it('returns nothing when no target exists', () => {
		expect(planSteps(steps, { mode: 'full' }).steps).toEqual([]);
		expect(planSteps(steps, { mode: 'resume' }).steps).toEqual([]);
	});
});

describe('waitFor', () => {
	it('resolves at once when the test already passes', async () => {
		await expect(waitFor(() => 'yes', 50)).resolves.toBe('yes');
	});

	it('resolves when the DOM changes to satisfy the test', async () => {
		const pending = waitFor(() => document.getElementById('late'), 1000);
		const el = document.createElement('div');
		el.id = 'late';
		document.body.appendChild(el);
		await expect(pending).resolves.toBe(el);
	});

	it('resolves null on timeout', async () => {
		await expect(waitFor(() => null, 20)).resolves.toBeNull();
	});
});

describe('revealTarget', () => {
	it('returns a visible target as is', async () => {
		const el = addEl('<div id="t"></div>');
		await expect(revealTarget({ target: '#t' })).resolves.toBe(el);
	});

	it('clicks the revealer, then returns the target it brings in', async () => {
		const tab = addEl('<button id="tab"></button>');
		tab.addEventListener('click', () => addEl('<div id="t"></div>'));

		const el = await revealTarget({ target: '#t', reveal: '#tab' });
		expect(el && el.id).toBe('t');
	});

	it('expands a collapsed metabox through its toggle', async () => {
		const box = addEl(
			'<div class="postbox closed"><button class="handlediv"></button><div id="t"></div></div>'
		);
		const target = box.querySelector('#t');
		const toggle = box.querySelector('.handlediv');
		toggle.addEventListener('click', () => {
			box.classList.remove('closed');
			layout(target);
		});

		await expect(revealTarget({ target: '#t' })).resolves.toBe(target);
		expect(box.classList.contains('closed')).toBe(false);
	});

	it('expands a collapsed metabox without a toggle', async () => {
		const box = addEl(
			'<div class="postbox closed"><div id="t"></div></div>'
		);
		layout(box.querySelector('#t'));

		await expect(revealTarget({ target: '#t' })).resolves.toBe(
			box.querySelector('#t')
		);
		expect(box.classList.contains('closed')).toBe(false);
	});

	it('returns null when neither the target nor a revealer exists', async () => {
		await expect(
			revealTarget({ target: '#t', reveal: '#tab' })
		).resolves.toBeNull();
	});

	it('returns null when the revealer does not bring the target in', async () => {
		addEl('<button id="tab"></button>');
		await expect(
			revealTarget({ target: '#t', reveal: '#tab' }, { timeoutMs: 20 })
		).resolves.toBeNull();
	});
});
