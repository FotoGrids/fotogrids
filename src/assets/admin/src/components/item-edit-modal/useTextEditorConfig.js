import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { bundledProfile, validateProfile } from '@packages/fg-formatted-text';

/**
 * Caption and description editor settings for the current user, from the
 * gallery screen's localized data.
 *
 * @returns {{profile: Object, disabledReason: string|null, reasonLink: Object|null, stripsFormatting: boolean, linkDefaults: Object}}
 */
export default function useTextEditorConfig() {
	return useMemo(() => {
		const config = window.fotogridsMetaBoxes?.textEditor || {};
		const canFormat = config.canFormat === true;
		const plain = config.mode === 'plain';
		const profile =
			config.profile && typeof config.profile === 'object'
				? validateProfile(config.profile)
				: bundledProfile();

		let disabledReason = null;
		let reasonLink = null;
		if (!canFormat) {
			disabledReason = __(
				"Your role can't add formatting to captions and descriptions.",
				'fotogrids'
			);
		} else if (plain) {
			disabledReason = __(
				'This site shows captions and descriptions as plain text.',
				'fotogrids'
			);
			if (config.settingsUrl) {
				reasonLink = {
					url: config.settingsUrl,
					label: __(
						'Change it in Gallery Items settings',
						'fotogrids'
					),
				};
			}
		}

		return {
			profile,
			disabledReason,
			reasonLink,
			stripsFormatting: !canFormat,
			linkDefaults: {
				newTab: config.linkDefaults?.newTab !== false,
				nofollow: config.linkDefaults?.nofollow === true,
			},
		};
	}, []);
}
