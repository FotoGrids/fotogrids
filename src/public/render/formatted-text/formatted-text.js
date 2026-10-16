/**
 * Browser formatter for captions and descriptions.
 *
 * Registers FotoGrids.modules.formattedText:
 *   render(element, raw, options)  formats `raw` into `element`
 *   toPlainText(raw)               plain text with "\n" line breaks
 *
 * Formatting rules come from the bundled schema, or from the profile in the
 * gallery's data-fg-text-<surface> attribute when a filter changed it.
 */
import {
	bundledProfile,
	render as renderFormatted,
	toPlainText as formatPlainText,
	validateProfile,
} from '@packages/fg-formatted-text';

const RENDERED_EVENT = 'fotogrids:formatted_text:rendered';
const PROFILE = 'item_text';

const configCache = new WeakMap();

function datasetKey(surface) {
	return (
		'fgText' +
		String(surface)
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join('')
	);
}

function readConfig(galleryEl, surface) {
	const defaults = {
		mode: 'basic',
		policy: { newTab: true, rel: [] },
		newTabLabel: '',
		profile: bundledProfile(PROFILE),
	};
	if (!galleryEl || !galleryEl.dataset) {
		return defaults;
	}

	let perGallery = configCache.get(galleryEl);
	if (!perGallery) {
		perGallery = {};
		configCache.set(galleryEl, perGallery);
	}
	if (perGallery[surface]) {
		return perGallery[surface];
	}

	let raw = null;
	try {
		raw = JSON.parse(galleryEl.dataset[datasetKey(surface)] || 'null');
	} catch (e) {
		raw = null;
	}

	const config = { ...defaults };
	if (raw && typeof raw === 'object') {
		config.mode = raw.mode === 'plain' ? 'plain' : 'basic';
		if (raw.policy && typeof raw.policy === 'object') {
			config.policy = {
				newTab: raw.policy.newTab === true,
				rel: Array.isArray(raw.policy.rel)
					? raw.policy.rel.filter(
							(token) => typeof token === 'string'
						)
					: [],
			};
		}
		if (raw.labels && typeof raw.labels.newTab === 'string') {
			config.newTabLabel = raw.labels.newTab;
		}
		if (raw.profile && typeof raw.profile === 'object') {
			config.profile = validateProfile(raw.profile);
		}
	}

	perGallery[surface] = config;
	return config;
}

/**
 * Formats a stored caption or description into an element.
 *
 * @param {Element} element             Target; its children are replaced.
 * @param {string}  raw                 Stored value.
 * @param {Object}  [options]
 * @param {string}  [options.surface]   'lightbox' | 'lightbox_mini' | 'lightbox_grid'.
 * @param {string}  [options.field]     'caption' | 'description'.
 * @param {boolean} [options.links]     Keep links; false shows their text only.
 * @param {string}  [options.itemId]    Item ID, passed on in the rendered event.
 * @param {Element} [options.galleryEl] Gallery wrapper carrying the configuration.
 */
function render(element, raw, options = {}) {
	if (!element) {
		return;
	}
	const surface = options.surface || 'lightbox';
	const links = options.links !== false;
	const galleryEl =
		options.galleryEl ||
		(element.closest ? element.closest('.fotogrids-gallery') : null);
	const config = readConfig(galleryEl, surface);

	renderFormatted(element, String(raw ?? ''), config.profile, {
		mode: config.mode,
		links,
		policy: links ? config.policy : null,
		newTabLabel: config.newTabLabel,
	});

	element.dispatchEvent(
		new CustomEvent(RENDERED_EVENT, {
			bubbles: true,
			detail: {
				element,
				profile: PROFILE,
				surface,
				field: options.field || '',
				itemId: String(options.itemId ?? ''),
				galleryEl: galleryEl || null,
			},
		})
	);
}

/**
 * Converts a stored caption or description to plain text.
 *
 * @param {string} raw Stored value.
 * @returns {string}
 */
function toPlainText(raw) {
	return formatPlainText(String(raw ?? ''), bundledProfile(PROFILE));
}

window.FotoGrids = window.FotoGrids || {};
window.FotoGrids.modules = window.FotoGrids.modules || {};
window.FotoGrids.modules.formattedText = Object.freeze({ render, toPlainText });
