/**
 * Deactivation feedback popup entry for the Plugins screen.
 *
 * Intercepts the FotoGrids "Deactivate" link, opens the FotoGrids admin modal
 * to collect a reason, forwards it to Freemius, then follows the original
 * deactivation link. Feedback submission is best-effort and never blocks
 * deactivation.
 */

import React from 'react';
import ReasonsForm from './ReasonsForm.jsx';

const SETTINGS_KEY = 'fotogridsDeactivation';
const POST_TIMEOUT_MS = 1500;

function getSettings() {
	return window[SETTINGS_KEY] || null;
}

/**
 * Test whether a clicked element is this plugin's Deactivate link.
 *
 * Matches the WordPress-generated deactivate link by its id
 * (`deactivate-<slug>`) or by a deactivate href targeting this plugin's
 * basename - independent of the row's data-plugin attribute, which is not
 * always present.
 *
 * @param {HTMLElement} target          The clicked element.
 * @param {string}      pluginBasename  This plugin's basename.
 * @return {HTMLAnchorElement|null} The matched link, or null.
 */
function matchDeactivateLink(target, pluginBasename) {
	if (!pluginBasename) return null;

	const link = target.closest && target.closest('a');
	if (!link) return null;

	const slug = pluginBasename.split('/')[0];
	if (link.id === `deactivate-${slug}`) {
		return link;
	}

	const href = link.getAttribute('href') || '';
	if (
		href.indexOf('action=deactivate') !== -1 &&
		href.indexOf(pluginBasename) !== -1
	) {
		return link;
	}

	const encoded = encodeURIComponent(pluginBasename);
	if (
		href.indexOf('action=deactivate') !== -1 &&
		href.indexOf(encoded) !== -1
	) {
		return link;
	}

	return null;
}

/**
 * POST the chosen reason to Freemius. Resolves regardless of outcome so the
 * caller can always proceed to deactivate.
 *
 * @param {Object} settings Localised settings.
 * @param {Object} reason   { id, details, snooze }.
 * @return {Promise<void>} Always resolves.
 */
function submitToFreemius(settings, reason) {
	const body = new URLSearchParams();
	body.set('action', settings.action);
	body.set('security', settings.security);
	body.set('reason_id', reason.id);
	body.set('reason_info', reason.details || '');
	if (reason.snooze) {
		body.set('snooze_period', String(settings.snoozePeriod));
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

	return fetch(settings.ajaxUrl, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		signal: controller.signal,
	})
		.catch(() => {})
		.finally(() => clearTimeout(timer));
}

function navigate(url) {
	window.location.assign(url);
}

function openModal(settings, link) {
	const api = window.FotoGridsAdmin && window.FotoGridsAdmin.modal;
	if (!api) {
		navigate(link.href);
		return;
	}

	const handle = api.open({
		type: 'custom',
		size: 'md',
		closeOnOverlay: false,
		render: ({ close }) =>
			React.createElement(ReasonsForm, {
				settings,
				onSubmit: async (reason) => {
					await submitToFreemius(settings, reason);
					close('programmatic');
					navigate(link.href);
				},
				onSkip: () => {
					close('programmatic');
					navigate(link.href);
				},
				onCancel: () => close('cancel'),
			}),
	});

	return handle;
}

function init() {
	const settings = getSettings();
	if (!settings) return;

	document.addEventListener(
		'click',
		(event) => {
			const link = matchDeactivateLink(
				event.target,
				settings.pluginBasename
			);
			if (!link) return;

			event.preventDefault();
			openModal(settings, link);
		},
		true
	);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
