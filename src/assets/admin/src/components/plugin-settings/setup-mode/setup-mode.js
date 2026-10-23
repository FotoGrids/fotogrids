/**
 * Site default setup mode: read, permission and save helpers for the
 * Settings > Defaults Setup Mode panel.
 *
 * @since 1.3.0
 */

export const EASY = 'easy';
export const ADVANCED = 'advanced';
export const MODES = [EASY, ADVANCED];
export const SETTING = 'fotogrids_settings_mode';

/**
 * Normalise a stored mode, falling back to Easy.
 *
 * @since 1.3.0
 * @param {unknown} value Raw value.
 * @return {string} 'easy' or 'advanced'.
 */
export const normalizeMode = (value) => (ADVANCED === value ? ADVANCED : EASY);

/**
 * The site default mode from the localised admin payload.
 *
 * @since 1.3.0
 * @param {Object} [admin] Localised fotogridsAdmin object.
 * @return {string} 'easy' or 'advanced'.
 */
export const readSiteMode = (admin = window.fotogridsAdmin) =>
	normalizeMode(admin?.siteSettingsMode);

/**
 * Whether the current user may change the site default.
 *
 * Reads as allowed when the capability snapshot is missing.
 *
 * @since 1.3.0
 * @param {Object} [admin] Localised fotogridsAdmin object.
 * @return {boolean} True unless the snapshot says the capability is missing.
 */
export const canEditSiteMode = (admin = window.fotogridsAdmin) =>
	admin?.capabilities?.manage_fotogrids_settings !== false;

/**
 * POST body for saving the site default.
 *
 * @since 1.3.0
 * @param {string} mode  Mode to save.
 * @param {string} nonce Admin nonce.
 * @return {FormData} Request body.
 */
export const buildSaveBody = (mode, nonce) => {
	const body = new FormData();
	body.append('action', 'fotogrids_update_plugin_setting');
	body.append('nonce', nonce || '');
	body.append('setting', SETTING);
	body.append('value', mode);
	return body;
};

/**
 * Save the site default through admin-ajax.
 *
 * @since 1.3.0
 * @param {string}   mode      Mode to save.
 * @param {Object}   [admin]   Localised fotogridsAdmin object.
 * @param {typeof fetch} [fetchFn] fetch implementation.
 * @return {Promise<{ok: boolean, value?: string}>} Outcome.
 */
export const saveSiteMode = async (
	mode,
	admin = window.fotogridsAdmin,
	fetchFn = window.fetch
) => {
	const url = admin?.ajaxUrl || window.ajaxurl;
	if (!url || !admin?.nonce || typeof fetchFn !== 'function') {
		return { ok: false };
	}

	try {
		const response = await fetchFn(url, {
			method: 'POST',
			credentials: 'same-origin',
			body: buildSaveBody(mode, admin.nonce),
		});
		if (!response?.ok) {
			return { ok: false };
		}
		const json = await response.json();
		if (true !== json?.success) {
			return { ok: false };
		}
		return { ok: true, value: normalizeMode(json.data?.value ?? mode) };
	} catch (e) {
		return { ok: false };
	}
};

/**
 * Apply a new site default optimistically, rolling back when the save fails.
 *
 * @since 1.3.0
 * @param {Object}   args
 * @param {string}   args.next      Mode the user picked.
 * @param {string}   args.current   Mode shown before the pick.
 * @param {(mode: string) => void} args.setMode State setter.
 * @param {Object}   args.messages  Toast strings: { saved, failed }.
 * @param {typeof saveSiteMode} [args.save] Save implementation.
 * @param {Object}   [args.admin]   Localised fotogridsAdmin object.
 * @param {Object}   [args.toast]   Toast API.
 * @return {Promise<boolean>} True when the new mode was saved.
 */
export const changeSiteMode = async ({
	next,
	current,
	setMode,
	messages,
	save = saveSiteMode,
	admin = window.fotogridsAdmin,
	toast = window.fotogridsToast,
}) => {
	const mode = normalizeMode(next);
	if (mode === current) {
		return true;
	}

	setMode(mode);
	const result = await save(mode, admin);

	if (result.ok) {
		if (admin) {
			admin.siteSettingsMode = result.value || mode;
		}
		toast?.success?.(messages.saved);
		return true;
	}

	setMode(current);
	toast?.error?.(messages.failed);
	return false;
};
