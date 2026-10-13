/**
 * Capabilities behind the Dashboard's actions, with the reason shown when the
 * current user lacks one.
 */
import { __ } from '@wordpress/i18n';

export const DASHBOARD_ACCESS = {
	gallery: {
		cap: 'edit_fotogrids_galleries',
		reason: __("Your role can't create or edit galleries.", 'fotogrids'),
	},
	album: {
		cap: 'edit_fotogrids_albums',
		reason: __("Your role can't create or edit albums.", 'fotogrids'),
	},
	templates: {
		cap: 'manage_fotogrids',
		reason: __("Your role can't use templates.", 'fotogrids'),
	},
	settings: {
		cap: 'manage_fotogrids_settings',
		reason: __("Your role can't change settings.", 'fotogrids'),
	},
	stats: {
		cap: 'view_fotogrids_stats',
		reason: __("Your role can't open Statistics.", 'fotogrids'),
	},
};
