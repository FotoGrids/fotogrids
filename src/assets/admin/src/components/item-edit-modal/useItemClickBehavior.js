import { useEffect, useState } from 'react';

const SETTING_KEY = 'item_click_behavior';

/**
 * Reads the collection's current Item Click Behavior.
 *
 * The settings panel writes every change to a hidden post-form input, so that
 * input is the freshest source; the localised payload covers the case where
 * the setting has not been touched since the page loaded.
 *
 * @returns {string} The stored value, or an empty string when unresolved.
 */
const readCurrentValue = () => {
	const input = document.querySelector(
		`input[name="fotogrids_${SETTING_KEY}"]`
	);

	if (input && input.value) {
		return input.value;
	}

	const localized = window.fotogridsSettings?.settings?.[SETTING_KEY];

	return typeof localized === 'string' ? localized : '';
};

/**
 * Tracks the collection's Item Click Behavior setting while the modal is open.
 *
 * @returns {string} The current behavior value.
 */
const useItemClickBehavior = () => {
	const [behavior, setBehavior] = useState(readCurrentValue);

	useEffect(() => {
		const handleSettingChanged = (event) => {
			const { key, value } = event.detail || {};

			if (key !== SETTING_KEY) {
				return;
			}

			setBehavior(typeof value === 'string' ? value : '');
		};

		document.addEventListener(
			'fotogrids:setting_changed',
			handleSettingChanged
		);

		return () => {
			document.removeEventListener(
				'fotogrids:setting_changed',
				handleSettingChanged
			);
		};
	}, []);

	return behavior;
};

export default useItemClickBehavior;
