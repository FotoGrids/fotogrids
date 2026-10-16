/**
 * fg-text-editor: a small visual editor for formatted captions and
 * descriptions. See README.md for the public API.
 */
export { default as Editor, CHANGE_EVENT } from './Editor';
export { defaultRegistry, getFeatures, registerFeature } from './registry';
export { createFeatureRegistry, matchesShortcut } from './features';
export { TextEngine } from './engine';
export * as commands from './commands';
export * as model from './model';
export {
	completeHref,
	initialChoice,
	isAllowedHref,
	linkAttributes,
} from './link';
