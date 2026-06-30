/**
 * persist-setting.js - tiny shared wrapper for the wizard's "save
 * immediately on interaction" pattern.
 *
 * The wizard's step components use the existing
 * `fotogrids_update_plugin_setting` admin-ajax handler (the same one
 * the autosave toggle in the collection-settings docs strip uses).
 * It's already nonce-protected, capability-gated, and bucketed into
 * boolean vs. string settings on the PHP side, so this helper stays
 * deliberately thin:
 *
 *   • Build the POST body.
 *   • Fire-and-forget the request (no spinner - by design).
 *   • If the server reports a value mismatch or an error, log a
 *     warning. We don't surface it as a toast: the steps are advisory
 *     defaults, not destructive operations.
 *
 * @param {string} setting  Allowlisted option name (e.g. `fotogrids_user_persona`).
 * @param {string|boolean} value
 * @returns {Promise<{ ok: boolean, value?: any }>}
 */
export async function persistSetting(setting, value) {
	const admin = window.fotogridsAdmin || {};
	const ajaxUrl = admin.ajaxUrl || window.ajaxurl;
	const nonce = admin.nonce || '';

	if (!ajaxUrl || !nonce) {
		// eslint-disable-next-line no-console
		console.warn(
			'FotoGrids: missing ajax url / nonce; persistSetting noop'
		);
		return { ok: false };
	}

	const body = new FormData();
	body.append('action', 'fotogrids_update_plugin_setting');
	body.append('nonce', nonce);
	body.append('setting', setting);
	body.append(
		'value',
		typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
	);

	try {
		const res = await fetch(ajaxUrl, { method: 'POST', body });
		if (!res.ok) {
			// eslint-disable-next-line no-console
			console.warn(
				`FotoGrids: persistSetting ${setting} HTTP ${res.status}`
			);
			return { ok: false };
		}
		const json = await res.json();
		if (!json || json.success !== true) {
			// eslint-disable-next-line no-console
			console.warn(`FotoGrids: persistSetting ${setting} refused`, json);
			return { ok: false };
		}

		// Mirror the saved value into the localized globals so other
		// components that mount later see the new value without a
		// full page reload.
		const saved =
			json.data &&
			Object.prototype.hasOwnProperty.call(json.data, 'value')
				? json.data.value
				: value;
		if (setting === 'fotogrids_share_statistics' && admin) {
			admin.shareStatistics = !!saved;
		}
		if (setting === 'fotogrids_settings_mode' && admin) {
			admin.settingsMode = String(saved);
		}
		if (setting === 'fotogrids_user_persona' && admin) {
			admin.userPersona = String(saved);
		}

		return { ok: true, value: saved };
	} catch (err) {
		// eslint-disable-next-line no-console
		console.warn(`FotoGrids: persistSetting ${setting} threw`, err);
		return { ok: false };
	}
}
