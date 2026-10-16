import type { Profile } from '../fg-formatted-text';
import { clearFormatting } from './commands';
import type { EngineState, TextEngine } from './engine';

export interface FeatureContext {
	engine: TextEngine;
	state: EngineState;
	/** Opens the feature's popover. */
	openPopover: () => void;
}

export interface FeatureToolbar {
	/** Icon: an SVG path ("d" attribute) on a 24 by 24 grid, or a short text glyph. */
	icon: { path?: string; text?: string };
	label: string;
	group?: string;
	order?: number;
}

export interface Feature {
	name: string;
	/**
	 * Element the feature produces. The feature is offered only when the
	 * profile allows it; null for features that produce no element.
	 */
	element: string | null;
	/** Elements treated as the same formatting, e.g. 'b' for bold. */
	aliases?: string[];
	toolbar?: FeatureToolbar;
	/** 'primary+b' style shortcut; primary is Ctrl, or Cmd on macOS. */
	shortcut?: string;
	isActive?: (context: FeatureContext) => boolean;
	command: (context: FeatureContext) => void;
	/** Popover component rendered under the toolbar while open. */
	popover?: unknown;
}

export interface FeatureRegistry {
	register: (feature: Feature) => boolean;
	get: (name: string) => Feature | undefined;
	list: (profile: Profile) => Feature[];
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function isValid(feature: Feature): boolean {
	return (
		!!feature &&
		typeof feature.name === 'string' &&
		NAME_PATTERN.test(feature.name) &&
		(feature.element === null || typeof feature.element === 'string') &&
		typeof feature.command === 'function'
	);
}

/**
 * Creates a feature registry. A name can be registered once.
 */
export function createFeatureRegistry(): FeatureRegistry {
	const features: Feature[] = [];
	return {
		register(feature: Feature): boolean {
			if (
				!isValid(feature) ||
				features.some((existing) => existing.name === feature.name)
			) {
				return false;
			}
			features.push(feature);
			return true;
		},
		get(name: string): Feature | undefined {
			return features.find((feature) => feature.name === name);
		},
		list(profile: Profile): Feature[] {
			return features
				.filter(
					(feature) =>
						feature.element === null ||
						!!profile.elements[feature.element]
				)
				.sort(
					(a, b) =>
						(a.toolbar?.order ?? 100) - (b.toolbar?.order ?? 100)
				);
		},
	};
}

/**
 * Whether a keyboard event matches a 'primary+shift+k' style shortcut.
 *
 * @param event    Keyboard event.
 * @param shortcut Shortcut definition.
 */
export function matchesShortcut(
	event: KeyboardEvent,
	shortcut: string
): boolean {
	const parts = shortcut.toLowerCase().split('+');
	const key = parts[parts.length - 1];
	const wantPrimary = parts.includes('primary');
	const wantShift = parts.includes('shift');
	const wantAlt = parts.includes('alt');
	const primary = event.metaKey || event.ctrlKey;
	return (
		event.key.toLowerCase() === key &&
		primary === wantPrimary &&
		event.shiftKey === wantShift &&
		event.altKey === wantAlt
	);
}

function markFeature(
	name: string,
	element: string,
	aliases: string[],
	toolbar: FeatureToolbar,
	shortcut: string
): Feature {
	const names = [element, ...aliases];
	return {
		name,
		element,
		aliases,
		toolbar,
		shortcut,
		isActive: ({ state }) => state.isMarked(names),
		command: ({ engine }) => engine.toggleMark(names),
	};
}

export interface BuiltInLabels {
	bold: string;
	italic: string;
	link: string;
	clear: string;
}

/**
 * Registers bold, italic, link and clear formatting.
 *
 * @param registry Registry to fill.
 * @param labels   Translated toolbar labels.
 */
export function registerBuiltInFeatures(
	registry: FeatureRegistry,
	labels: BuiltInLabels
): void {
	registry.register(
		markFeature(
			'bold',
			'strong',
			['b'],
			{
				icon: { text: 'B' },
				label: labels.bold,
				group: 'marks',
				order: 10,
			},
			'primary+b'
		)
	);
	registry.register(
		markFeature(
			'italic',
			'em',
			['i'],
			{
				icon: { text: 'I' },
				label: labels.italic,
				group: 'marks',
				order: 20,
			},
			'primary+i'
		)
	);
	registry.register({
		name: 'link',
		element: 'a',
		toolbar: {
			icon: {
				path: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
			},
			label: labels.link,
			group: 'insert',
			order: 30,
		},
		shortcut: 'primary+k',
		isActive: ({ state }) => state.link !== null,
		command: ({ openPopover }) => openPopover(),
	});
	registry.register({
		name: 'clear',
		element: null,
		toolbar: {
			icon: {
				path: 'M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
			},
			label: labels.clear,
			group: 'clear',
			order: 90,
		},
		command: ({ engine }) =>
			engine.run((doc, selection) =>
				clearFormatting(doc, selection, engine.profile())
			),
	});
}
