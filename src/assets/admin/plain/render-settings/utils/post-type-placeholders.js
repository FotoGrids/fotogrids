/**
 * Post-type placeholder helpers
 *
 * Shared utilities for replacing {postType} placeholders in setting strings
 * (labels, descriptions, hints, options, sub-tabs, etc.) so the same setting
 * catalog can be reused for both galleries and albums.
 *
 * Loaded as a standalone script before the render-* helpers and before
 * collection-settings.js, so both layers can reach the same implementation
 * via window.FotoGridsRenderSettings.
 *
 * Wrapped in an IIFE so the internal `const` declarations don't pollute the
 * shared script-tag global scope — every script in this folder loads as a
 * plain <script>, so a top-level `const` here would collide with the same
 * name declared in collection-settings.js.
 *
 * Supported placeholders:
 *   {postType}              → "Gallery" or "Album"
 *   {postType.lower}        → "gallery" or "album"
 *   {postType.plural}       → "Galleries" or "Albums"
 *   {postType.plural.lower} → "galleries" or "albums"
 */
(function () {
	'use strict';

	/**
	 * Resolve a postType property path to its display string.
	 *
	 * @param {string} normalizedPostType - 'gallery' or 'album'
	 * @param {string} propertyPath - e.g. '', 'lower', 'plural', 'plural.lower'
	 * @returns {string}
	 */
	const getPostTypeValue = (normalizedPostType, propertyPath = '') => {
		const isAlbum = normalizedPostType === 'album';

		const base = {
			'': isAlbum ? 'Album' : 'Gallery',
			lower: isAlbum ? 'album' : 'gallery',
			plural: isAlbum ? 'Albums' : 'Galleries',
			'plural.lower': isAlbum ? 'albums' : 'galleries',
		};

		if (!propertyPath) {
			return base[''];
		}

		return base[propertyPath] !== undefined ? base[propertyPath] : base[''];
	};

	/**
	 * Replace every {postType} / {postType.x} placeholder in a string.
	 *
	 * Returns the input unchanged when it isn't a string (safe for optional fields).
	 *
	 * @param {string} text
	 * @param {string} normalizedPostType - 'gallery' or 'album'
	 * @returns {string}
	 */
	const replacePostTypePlaceholders = (text, normalizedPostType) => {
		if (!text || typeof text !== 'string') {
			return text;
		}

		return text.replace(
			/\{postType(?:\.([^}]+))?\}/g,
			(match, propertyPath) => {
				return getPostTypeValue(normalizedPostType, propertyPath || '');
			},
		);
	};

	/**
	 * Walk a setting object and replace placeholders in every user-visible string.
	 *
	 * Covers: label, description, hint, hint_link.label, options[].label/description,
	 * conditionalMessage.message, messages[].subtitle/message, nested settings,
	 * and subTabs (also filtered by postTypes).
	 *
	 * @param {Object} setting
	 * @param {string} normalizedPostType - 'gallery' or 'album'
	 * @returns {Object}
	 */
	const processSettingPlaceholders = (setting, normalizedPostType) => {
		if (!setting || typeof setting !== 'object') {
			return setting;
		}

		const processed = { ...setting };

		if (processed.label) {
			processed.label = replacePostTypePlaceholders(
				processed.label,
				normalizedPostType,
			);
		}

		if (processed.description) {
			processed.description = replacePostTypePlaceholders(
				processed.description,
				normalizedPostType,
			);
		}

		if (processed.hint) {
			processed.hint = replacePostTypePlaceholders(
				processed.hint,
				normalizedPostType,
			);
		}

		if (processed.hint_link && processed.hint_link.label) {
			processed.hint_link = {
				...processed.hint_link,
				label: replacePostTypePlaceholders(
					processed.hint_link.label,
					normalizedPostType,
				),
			};
		}

		// info_block top-level strings: subtitle, message, button_label.
		// (button_url is intentionally not substituted — it's a URL, not user-visible copy.)
		if (processed.subtitle) {
			processed.subtitle = replacePostTypePlaceholders(
				processed.subtitle,
				normalizedPostType,
			);
		}

		if (processed.message) {
			processed.message = replacePostTypePlaceholders(
				processed.message,
				normalizedPostType,
			);
		}

		if (processed.button_label) {
			processed.button_label = replacePostTypePlaceholders(
				processed.button_label,
				normalizedPostType,
			);
		}

		if (processed.options && Array.isArray(processed.options)) {
			processed.options = processed.options
				.filter(option => {
					if (option.postTypes && Array.isArray(option.postTypes)) {
						return option.postTypes.includes(normalizedPostType);
					}
					return true;
				})
				.map(option => {
					const processedOption = { ...option };
					if (processedOption.label) {
						processedOption.label = replacePostTypePlaceholders(
							processedOption.label,
							normalizedPostType,
						);
					}
					if (processedOption.description) {
						processedOption.description =
							replacePostTypePlaceholders(
								processedOption.description,
								normalizedPostType,
							);
					}
					return processedOption;
				});
		}

		if (processed.conditionalMessage?.message) {
			processed.conditionalMessage = {
				...processed.conditionalMessage,
				message: replacePostTypePlaceholders(
					processed.conditionalMessage.message,
					normalizedPostType,
				),
			};
		}

		if (processed.messages && Array.isArray(processed.messages)) {
			processed.messages = processed.messages.map(msg => {
				const processedMsg = { ...msg };
				if (processedMsg.subtitle) {
					processedMsg.subtitle = replacePostTypePlaceholders(
						processedMsg.subtitle,
						normalizedPostType,
					);
				}
				if (processedMsg.message) {
					processedMsg.message = replacePostTypePlaceholders(
						processedMsg.message,
						normalizedPostType,
					);
				}
				return processedMsg;
			});
		}

		if (processed.settings && Array.isArray(processed.settings)) {
			processed.settings = processed.settings.map(subSetting =>
				processSettingPlaceholders(subSetting, normalizedPostType),
			);
		}

		if (processed.subTabs) {
			const processedSubTabs = {};
			Object.keys(processed.subTabs).forEach(subTabKey => {
				const subTab = { ...processed.subTabs[subTabKey] };

				if (subTab.postTypes && Array.isArray(subTab.postTypes)) {
					if (!subTab.postTypes.includes(normalizedPostType)) {
						return;
					}
				}

				if (subTab.label) {
					subTab.label = replacePostTypePlaceholders(
						subTab.label,
						normalizedPostType,
					);
				}
				if (subTab.settings && Array.isArray(subTab.settings)) {
					subTab.settings = subTab.settings.map(subSetting =>
						processSettingPlaceholders(
							subSetting,
							normalizedPostType,
						),
					);
				}
				processedSubTabs[subTabKey] = subTab;
			});
			processed.subTabs = processedSubTabs;
		}

		return processed;
	};

	window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};
	window.FotoGridsRenderSettings.getPostTypeValue = getPostTypeValue;
	window.FotoGridsRenderSettings.replacePostTypePlaceholders =
		replacePostTypePlaceholders;
	window.FotoGridsRenderSettings.processSettingPlaceholders =
		processSettingPlaceholders;
})();
