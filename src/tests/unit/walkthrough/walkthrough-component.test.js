/**
 * The walkthrough controller and step bubble on a gallery-like page.
 */
import React, { act } from 'react';
import Walkthrough, {
	START_EVENT,
} from '@modules/Walkthrough/assets/src/components/Walkthrough';
import { getTours } from '@modules/Walkthrough/assets/src/tours';
import { renderElement } from '@tests/helpers/render-component';
import { addEl, layout } from './helpers';

const h = React.createElement;

let view;
let modal;
let saved;

const config = (overrides = {}) => ({
	tour: 'gallery',
	autoStart: '',
	resume: '',
	forced: '',
	ajaxUrl: '/wp-admin/admin-ajax.php',
	nonce: 'n',
	preference: 'walkthrough',
	...overrides,
});

/**
 * Build the parts of the gallery edit screen the gallery tour points at.
 *
 * @param {Object}  [opts]
 * @param {boolean} [opts.saved]    Whether the Shortcode box exists.
 * @param {boolean} [opts.settings] Whether the settings box exists.
 */
const buildGalleryScreen = ({
	saved: isSaved = false,
	settings = true,
} = {}) => {
	addEl(
		'<div class="fotogrids-gallery-header">' +
			'<button data-fg-walkthrough="gallery-tab-manage"></button>' +
			'<button data-fg-walkthrough="gallery-tab-preview"></button>' +
			'</div>'
	);
	document
		.querySelectorAll('.fotogrids-gallery-header button')
		.forEach((el) => layout(el));
	addEl('<div data-fg-walkthrough="gallery-add-items"></div>');
	if (settings) {
		const tab = addEl('<button data-fg-settings-tab="layout"></button>');
		tab.addEventListener('click', () => {
			if (!document.querySelector('[data-fg-setting="layout"]')) {
				addEl('<div data-fg-setting="layout"></div>');
			}
		});
	}
	addEl('<input type="submit" id="publish" />');
	if (isSaved) {
		addEl('<div id="fotogrids_gallery_shortcode"></div>');
	}
};

const flush = async (ms = 0) => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
};

const waitUntil = async (test, timeout = 3000) => {
	const started = Date.now();
	while (!test()) {
		if (Date.now() - started > timeout) {
			throw new Error('Timed out waiting');
		}
		// eslint-disable-next-line no-await-in-loop
		await flush(20);
	}
};

const bubble = () => document.querySelector('.fotogrids-walkthrough-bubble');
const stepId = () => bubble()?.getAttribute('data-step');
const button = (selector) => bubble().querySelector(selector);
const press = async (selector) => {
	await act(async () => {
		button(selector).click();
	});
	await flush(30);
};

const mount = (cfg, tourId = 'gallery') => {
	const tour = getTours()[tourId];
	view = renderElement(h(Walkthrough, { tour, config: cfg }));
};

beforeEach(() => {
	saved = [];
	window.fetch = jest.fn((url, options) => {
		saved.push(options.body.get('value'));
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: true }),
		});
	});
	modal = {
		question: jest.fn(() => Promise.resolve(true)),
		success: jest.fn(() => Promise.resolve()),
	};
	window.FotoGridsAdmin = { modal };
});

afterEach(() => {
	view?.unmount();
	view = null;
	document.body.innerHTML = '';
	delete window.fetch;
	delete window.FotoGridsAdmin;
});

describe('auto-start', () => {
	it('shows the intro, then the first step with its count', async () => {
		buildGalleryScreen();
		mount(config({ autoStart: '1' }));

		await waitUntil(() => bubble());
		expect(modal.question).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Build your first gallery',
				confirmLabel: 'Start the tour',
				cancelLabel: 'Not now',
			})
		);
		expect(stepId()).toBe('add-items');
		expect(bubble().textContent).toContain('Step 1 of 4');
	});

	it('Not now closes the tour and stores skipped', async () => {
		buildGalleryScreen();
		modal.question.mockResolvedValue(false);
		mount(config({ autoStart: '1' }));

		await waitUntil(() => saved.length > 0);
		expect(saved).toEqual(['gallery:skipped']);
		expect(bubble()).toBeNull();
	});

	it('does not open when no target exists, and stores nothing', async () => {
		addEl('<div class="fotogrids-gallery-header"></div>');
		mount(config({ autoStart: '1' }));

		await flush(450);
		expect(modal.question).not.toHaveBeenCalled();
		expect(bubble()).toBeNull();
		expect(saved).toEqual([]);
	});

	it('opens with ?fotogrids_walkthrough=1 whatever the state', async () => {
		buildGalleryScreen();
		mount(config({ forced: '1' }));

		await waitUntil(() => bubble());
		expect(modal.question).toHaveBeenCalled();
	});

	it('stays closed without an auto-start, resume or replay', async () => {
		buildGalleryScreen();
		mount(config());

		await flush(450);
		expect(bubble()).toBeNull();
	});
});

describe('running a tour', () => {
	beforeEach(async () => {
		buildGalleryScreen();
		mount(config({ autoStart: '1' }));
		await waitUntil(() => bubble());
	});

	it('is a labelled non-modal dialog with focus on its title', () => {
		const el = bubble();
		expect(el.getAttribute('role')).toBe('dialog');
		expect(el.getAttribute('aria-modal')).toBe('false');
		const title = document.getElementById(
			el.getAttribute('aria-labelledby')
		);
		expect(title.textContent).toBe('Add your images');
		expect(document.activeElement).toBe(title);
	});

	it('announces the step in a polite live region', () => {
		const live = document.querySelector('[aria-live="polite"]');
		expect(live.textContent).toBe('Step 1 of 4: Add your images');
	});

	it('has no Back on the first step', () => {
		expect(button('.fotogrids-walkthrough-bubble__back')).toBeNull();
	});

	it('Next activates the Layout tab and points at Layout Type', async () => {
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'layout');

		expect(
			document.querySelector('[data-fg-setting="layout"]')
		).not.toBeNull();
		expect(bubble().textContent).toContain('Step 2 of 4');
	});

	it('Back returns to the previous step', async () => {
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'layout');
		await press('.fotogrids-walkthrough-bubble__back');
		await waitUntil(() => stepId() === 'add-items');
	});

	it('Skip tour stores skipped and closes', async () => {
		await press('.fotogrids-walkthrough-bubble__skip');

		expect(bubble()).toBeNull();
		await waitUntil(() => saved.includes('gallery:skipped'));
	});

	it('Esc stores skipped and closes', async () => {
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
			);
		});
		await flush(20);

		expect(bubble()).toBeNull();
		expect(saved).toContain('gallery:skipped');
	});

	it('Esc inside another dialog is left to that dialog', async () => {
		const other = addEl(
			'<div role="dialog"><button id="other">x</button></div>'
		);
		other.querySelector('#other').focus();
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
			);
		});

		expect(bubble()).not.toBeNull();
	});

	it('defers the last part on a new gallery and stores publish-pending at Publish', async () => {
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'layout');
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'preview');
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'publish');

		expect(saved).toContain('gallery:publish-pending');
		expect(bubble().textContent).toContain('this tour comes back');
		expect(button('.fotogrids-walkthrough-bubble__next').textContent).toBe(
			'Got it'
		);

		await press('.fotogrids-walkthrough-bubble__next');
		expect(bubble()).toBeNull();
		expect(saved).not.toContain('gallery:done');
		expect(modal.success).not.toHaveBeenCalled();
	});
});

describe('saved gallery', () => {
	it('runs every step in one go and stores done with a finish card', async () => {
		buildGalleryScreen({ saved: true });
		mount(config({ autoStart: '1' }));
		await waitUntil(() => bubble());
		expect(bubble().textContent).toContain('Step 1 of 5');

		for (const id of ['layout', 'preview', 'publish', 'place']) {
			// eslint-disable-next-line no-await-in-loop
			await press('.fotogrids-walkthrough-bubble__next');
			// eslint-disable-next-line no-await-in-loop
			await waitUntil(() => stepId() === id);
		}
		expect(button('.fotogrids-walkthrough-bubble__next').textContent).toBe(
			'Done'
		);
		await press('.fotogrids-walkthrough-bubble__next');

		expect(bubble()).toBeNull();
		expect(saved).toEqual(['gallery:done']);
		expect(modal.success).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Your gallery is ready' })
		);
	});

	it('resume opens only the place step, without an intro', async () => {
		buildGalleryScreen({ saved: true });
		mount(config({ resume: '1' }));
		await waitUntil(() => bubble());

		expect(modal.question).not.toHaveBeenCalled();
		expect(stepId()).toBe('place');
		expect(bubble().textContent).toContain('Step 1 of 1');

		await press('.fotogrids-walkthrough-bubble__next');
		expect(saved).toEqual(['gallery:done']);
	});
});

describe('replay and missing targets', () => {
	it('the start event replays the tour without an intro', async () => {
		buildGalleryScreen();
		mount(config());
		await flush(10);

		await act(async () => {
			document.dispatchEvent(new CustomEvent(START_EVENT));
		});
		await waitUntil(() => bubble());

		expect(modal.question).not.toHaveBeenCalled();
		expect(stepId()).toBe('add-items');
	});

	it('a second start while running is ignored', async () => {
		buildGalleryScreen();
		mount(config());
		await act(async () => {
			document.dispatchEvent(new CustomEvent(START_EVENT));
			document.dispatchEvent(new CustomEvent(START_EVENT));
		});
		await waitUntil(() => bubble());

		expect(
			document.querySelectorAll('.fotogrids-walkthrough-bubble')
		).toHaveLength(1);
	});

	it('leaves out a step whose control is not on the page', async () => {
		buildGalleryScreen({ settings: false });
		mount(config({ autoStart: '1' }));
		await waitUntil(() => bubble());

		expect(bubble().textContent).toContain('Step 1 of 3');
		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'preview');
	});

	it('skips a step whose revealer does not bring the control in', async () => {
		buildGalleryScreen({ settings: false });
		addEl('<button data-fg-settings-tab="layout"></button>');
		mount(config({ autoStart: '1' }));
		await waitUntil(() => bubble());
		expect(bubble().textContent).toContain('Step 1 of 4');

		await press('.fotogrids-walkthrough-bubble__next');
		await waitUntil(() => stepId() === 'preview', 5000);
		expect(bubble().textContent).toContain('Step 2 of 3');
	});

	it('moves on when the target disappears during its step', async () => {
		buildGalleryScreen();
		mount(config({ autoStart: '1' }));
		await waitUntil(() => bubble());

		await act(async () => {
			document
				.querySelector('[data-fg-walkthrough="gallery-add-items"]')
				.remove();
		});
		await waitUntil(() => stepId() === 'layout');
	});

	it('returns focus to where it was when the tour closes', async () => {
		buildGalleryScreen();
		const before = addEl('<button id="before">x</button>');
		before.focus();
		mount(config());
		await act(async () => {
			document.dispatchEvent(new CustomEvent(START_EVENT));
		});
		await waitUntil(() => bubble());
		await press('.fotogrids-walkthrough-bubble__skip');

		expect(document.activeElement).toBe(before);
	});
});

describe('dashboard tour', () => {
	it('walks the Dashboard cards and finishes with done', async () => {
		['start', 'upload', 'create', 'learn'].forEach((id) =>
			addEl(`<div data-fg-walkthrough="dashboard-${id}"></div>`)
		);
		mount(config({ tour: 'dashboard', autoStart: '1' }), 'dashboard');
		await waitUntil(() => bubble());

		expect(bubble().textContent).toContain('Step 1 of 4');
		for (let i = 0; i < 3; i++) {
			// eslint-disable-next-line no-await-in-loop
			await press('.fotogrids-walkthrough-bubble__next');
		}
		await waitUntil(() => stepId() === 'learn');
		await press('.fotogrids-walkthrough-bubble__next');

		expect(saved).toEqual(['dashboard:done']);
	});
});
