/**
 * Fire-and-forget admin-ajax POST. Failures log a warning, not a toast.
 *
 * @since 1.3.0
 * @param {string}                 action Ajax action.
 * @param {Record<string, string>} fields Extra POST fields.
 * @param {string}                 label  Name used in warnings.
 * @returns {Promise<{ ok: boolean, json?: { success: boolean, data?: Object } }>}
 */
async function postAdminAjax(action, fields, label) {
	const admin = window.fotogridsAdmin || {};
	const ajaxUrl = admin.ajaxUrl || window.ajaxurl;
	const nonce = admin.nonce || '';

	if (!ajaxUrl || !nonce) {
		console.warn(`FotoGrids: missing ajax url / nonce; ${label} noop`);
		return { ok: false };
	}

	const body = new FormData();
	body.append('action', action);
	body.append('nonce', nonce);
	Object.keys(fields).forEach((key) => body.append(key, fields[key]));

	try {
		const res = await fetch(ajaxUrl, { method: 'POST', body });
		if (!res.ok) {
			console.warn(`FotoGrids: ${label} HTTP ${res.status}`);
			return { ok: false };
		}
		const json = await res.json();
		if (!json || json.success !== true) {
			console.warn(`FotoGrids: ${label} refused`, json);
			return { ok: false };
		}
		return { ok: true, json };
	} catch (err) {
		console.warn(`FotoGrids: ${label} threw`, err);
		return { ok: false };
	}
}

/**
 * The saved value from a success response, else the submitted one.
 *
 * @since 1.3.0
 * @param {{ data?: Object }} json Response body.
 * @param {unknown}          value Submitted value.
 * @returns {unknown}
 */
function savedValue(json, value) {
	return json.data && Object.prototype.hasOwnProperty.call(json.data, 'value')
		? json.data.value
		: value;
}

/**
 * Save a site option through `fotogrids_update_plugin_setting` and mirror
 * the saved value into `window.fotogridsAdmin`.
 *
 * @param {string}         setting Allowlisted option name (e.g. `fotogrids_user_persona`).
 * @param {string|boolean} value
 * @returns {Promise<{ ok: boolean, value?: unknown }>}
 */
export async function persistSetting(setting, value) {
	const result = await postAdminAjax(
		'fotogrids_update_plugin_setting',
		{
			setting,
			value:
				typeof value === 'boolean'
					? String(Number(value))
					: String(value),
		},
		`persistSetting ${setting}`
	);
	if (!result.ok) {
		return { ok: false };
	}

	const admin = window.fotogridsAdmin || {};
	const saved = savedValue(result.json, value);
	if (setting === 'fotogrids_share_statistics') {
		admin.shareStatistics = !!saved;
	}
	if (setting === 'fotogrids_settings_mode') {
		admin.siteSettingsMode = String(saved);
	}
	if (setting === 'fotogrids_user_persona') {
		admin.userPersona = String(saved);
	}

	return { ok: true, value: saved };
}

/**
 * Save a preference of the current user through
 * `fotogrids_update_user_preference` and mirror it into `window.fotogridsAdmin`.
 *
 * @since 1.3.0
 * @param {string} preference `settings_mode` or `settings_mode_tip_dismissed`.
 * @param {string} value
 * @returns {Promise<{ ok: boolean, value?: unknown }>}
 */
export async function persistUserPreference(preference, value) {
	const result = await postAdminAjax(
		'fotogrids_update_user_preference',
		{ preference, value: String(value) },
		`persistUserPreference ${preference}`
	);
	if (!result.ok) {
		return { ok: false };
	}

	const admin = window.fotogridsAdmin || {};
	const saved = savedValue(result.json, value);
	if (preference === 'settings_mode') {
		admin.settingsMode = String(saved);
	}
	if (preference === 'settings_mode_tip_dismissed') {
		admin.showSettingsModeTip = '';
	}

	return { ok: true, value: saved };
}
