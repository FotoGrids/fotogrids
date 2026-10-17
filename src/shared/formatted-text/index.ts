import { bundledProfile, type Profile } from './schema';
import { parse, type FormatOptions } from './document';
import { nodesToFragment, nodesToHtml, nodesToText } from './serialize';

export {
	DEFAULT_PROFILE,
	FLOOR,
	bundledProfile,
	isFloorAttribute,
	validateProfile,
} from './schema';
export type { AttributeSpec, ElementSpec, Profile } from './schema';
export { SCREEN_READER_CLASS, VOID_ELEMENTS, parse } from './document';
export type {
	FormatNode,
	FormatOptions,
	LinkPolicy,
	ParseResult,
} from './document';
export { decodeEntities, escapeAttribute, escapeText } from './entities';
export { nodesToFragment, nodesToHtml, nodesToText } from './serialize';
export { tokenize } from './tokenize';

/**
 * Formats stored text as safe HTML.
 *
 * @param raw     Stored caption or description.
 * @param profile Effective profile; the bundled default when omitted.
 * @param options Mode, link and length options.
 */
export function toHtml(
	raw: string,
	profile: Profile = bundledProfile(),
	options: FormatOptions = {}
): string {
	return nodesToHtml(parse(raw, profile, options).nodes);
}

/**
 * Converts stored text to plain text with "\n" line breaks.
 *
 * @param raw     Stored caption or description.
 * @param profile Effective profile; the bundled default when omitted.
 */
export function toPlainText(
	raw: string,
	profile: Profile = bundledProfile()
): string {
	return nodesToText(parse(raw, profile, { mode: 'plain' }).nodes);
}

/**
 * Returns the canonical stored form of a value and whether producing it
 * dropped anything.
 *
 * In plain mode every tag is removed and the text is stored escaped, so it
 * reads back exactly as typed.
 *
 * @param raw     Value to normalize.
 * @param profile Effective profile; the bundled default when omitted.
 * @param mode    'basic' keeps allowed formatting, 'plain' keeps text only.
 */
export function normalize(
	raw: string,
	profile: Profile = bundledProfile(),
	mode: 'basic' | 'plain' = 'basic'
): { html: string; lossy: boolean } {
	const result = parse(raw, profile, { mode, links: true, policy: null });
	return { html: nodesToHtml(result.nodes, true), lossy: result.lossy };
}

/**
 * Replaces an element's children with the formatted value.
 *
 * Nodes are created one by one; no markup string is ever assigned to the
 * element.
 *
 * @param element Target element.
 * @param raw     Stored caption or description.
 * @param profile Effective profile; the bundled default when omitted.
 * @param options Mode, link and length options.
 */
export function render(
	element: Element,
	raw: string,
	profile: Profile = bundledProfile(),
	options: FormatOptions = {}
): void {
	const fragment = nodesToFragment(
		parse(raw, profile, options).nodes,
		element.ownerDocument
	);
	element.replaceChildren(fragment);
}
