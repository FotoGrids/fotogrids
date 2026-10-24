/**
 * Saving a user's walkthrough progress.
 */

/**
 * Store the state of a tour for the current user. Failures are ignored: the
 * tour has already closed, and an unsaved state only means it may run again.
 *
 * `keepalive` lets the request finish when the step's target navigates away
 * (the Publish button submits the form).
 *
 * @param {string} tour  Tour id.
 * @param {string} state `publish-pending` | `done` | `skipped`.
 * @param {Object} [config] Localised walkthrough data.
 * @returns {Promise<boolean>} Whether the server stored it.
 */
export const saveState = (
	tour,
	state,
	config = window.fotogridsWalkthrough || {}
) => {
	if (!config.ajaxUrl || typeof window.fetch !== 'function') {
		return Promise.resolve(false);
	}

	const body = new FormData();
	body.append('action', 'fotogrids_update_user_preference');
	body.append('nonce', config.nonce || '');
	body.append('preference', config.preference || 'walkthrough');
	body.append('value', `${tour}:${state}`);

	return window
		.fetch(config.ajaxUrl, {
			method: 'POST',
			body,
			credentials: 'same-origin',
			keepalive: true,
		})
		.then((response) => (response.ok ? response.json() : null))
		.then((json) => Boolean(json && json.success))
		.catch(() => false);
};
