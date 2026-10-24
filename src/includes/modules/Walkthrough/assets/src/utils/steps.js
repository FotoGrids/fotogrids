/**
 * Resolving walkthrough steps against the live page.
 */

/**
 * Whether an element is rendered and takes up space.
 *
 * @param {Element|null} el Element.
 * @returns {boolean}
 */
export const isVisible = (el) => {
	if (!el || !el.isConnected) {
		return false;
	}
	if (el.closest('[hidden], [aria-hidden="true"]')) {
		return false;
	}
	const rect = el.getBoundingClientRect();
	return rect.width > 0 || rect.height > 0;
};

const query = (doc, selector) =>
	selector ? doc.querySelector(selector) : null;

/**
 * The step's target when it is on the page now.
 *
 * @param {Object}   step Step definition.
 * @param {Document} doc  Document.
 * @returns {Element|null}
 */
export const findTarget = (step, doc = document) => {
	const el = query(doc, step.target);
	if (!el) {
		return null;
	}
	const box = el.closest('.postbox.closed');
	return box || isVisible(el) ? el : null;
};

/**
 * Whether the step can be shown: its target exists, or something that reveals
 * it does.
 *
 * @param {Object}   step Step definition.
 * @param {Document} doc  Document.
 * @returns {boolean}
 */
export const isAvailable = (step, doc = document) =>
	Boolean(
		findTarget(step, doc) ||
		(step.reveal && isVisible(query(doc, step.reveal)))
	);

/**
 * The steps to run for a mode.
 *
 * In `resume` mode only the `place` part runs. Otherwise every available step
 * runs; `place` steps that are not available yet are reported as deferred.
 *
 * @param {Object[]} steps Step definitions.
 * @param {Object}   opts
 * @param {'full'|'resume'} opts.mode Run mode.
 * @param {Document} [opts.doc]       Document.
 * @returns {{steps:Object[], deferred:boolean}}
 */
export const planSteps = (steps, { mode, doc = document }) => {
	const pool =
		mode === 'resume'
			? steps.filter((step) => step.part === 'place')
			: steps;
	const available = pool.filter((step) => isAvailable(step, doc));
	const deferred =
		mode !== 'resume' &&
		steps.some(
			(step) => step.part === 'place' && !available.includes(step)
		);

	return { steps: available, deferred };
};

/**
 * Wait until `test()` returns a truthy value, checking on DOM changes.
 *
 * @param {() => (Element|null)} test Check to run.
 * @param {number}    timeoutMs Give up after this long.
 * @param {Document}  doc       Document.
 * @returns {Promise<Element|null>} The element, or null on timeout.
 */
export const waitFor = (test, timeoutMs, doc = document) =>
	new Promise((resolve) => {
		const first = test();
		if (first) {
			resolve(first);
			return;
		}
		let done = false;
		const finish = (value) => {
			if (done) {
				return;
			}
			done = true;
			observer.disconnect();
			clearTimeout(timer);
			resolve(value);
		};
		const observer = new MutationObserver(() => {
			const value = test();
			if (value) {
				finish(value);
			}
		});
		observer.observe(doc.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'hidden', 'style'],
		});
		const timer = setTimeout(() => finish(test() || null), timeoutMs);
	});

/**
 * Bring the step's target onto the page: expand a collapsed metabox, click
 * the step's revealer (a tab), then wait for the target.
 *
 * @param {Object}   step      Step definition.
 * @param {Object}   [opts]
 * @param {Document} [opts.doc]
 * @param {number}   [opts.timeoutMs]
 * @returns {Promise<Element|null>}
 */
export const revealTarget = async (
	step,
	{ doc = document, timeoutMs = 2000 } = {}
) => {
	let el = findTarget(step, doc);

	if (!el && step.reveal) {
		const revealer = query(doc, step.reveal);
		if (revealer && isVisible(revealer)) {
			revealer.click();
			el = await waitFor(() => findTarget(step, doc), timeoutMs, doc);
		}
	}

	if (!el) {
		return null;
	}

	const box = el.closest('.postbox.closed');
	if (box) {
		const toggle = box.querySelector('.handlediv');
		if (toggle) {
			toggle.click();
		} else {
			box.classList.remove('closed');
		}
		el = await waitFor(() => (isVisible(el) ? el : null), timeoutMs, doc);
	}

	return el && isVisible(el) ? el : null;
};
