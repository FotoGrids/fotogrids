import { __ } from '@wordpress/i18n';
import { createFeatureRegistry, registerBuiltInFeatures } from './features';

/**
 * The shared feature registry, holding the built-in features. Editors use
 * it unless they are given a registry of their own.
 */
export const defaultRegistry = createFeatureRegistry();

registerBuiltInFeatures(defaultRegistry, {
	bold: __('Bold', 'fotogrids'),
	italic: __('Italic', 'fotogrids'),
	link: __('Link', 'fotogrids'),
	clear: __('Clear formatting', 'fotogrids'),
});

/**
 * Adds a feature to the shared registry.
 *
 * @param {Object} feature Feature definition.
 * @returns {boolean} False when the definition is invalid or the name is taken.
 */
export function registerFeature(feature) {
	return defaultRegistry.register(feature);
}

/**
 * Features of the shared registry that the profile allows.
 *
 * @param {Object} profile Effective profile.
 * @returns {Object[]}
 */
export function getFeatures(profile) {
	return defaultRegistry.list(profile);
}
