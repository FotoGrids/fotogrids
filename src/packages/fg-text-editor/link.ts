import { parse, type Profile } from '../fg-formatted-text';
import type { Attributes } from './model';

export interface LinkDefaults {
	newTab: boolean;
	nofollow: boolean;
}

export interface LinkChoice {
	href: string;
	newTab: boolean;
	nofollow: boolean;
	/** The new-tab choice differs from what the link showed when opened. */
	newTabTouched: boolean;
	/** The nofollow choice differs from what the link showed when opened. */
	nofollowTouched: boolean;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Completes a typed link address: "example.com" becomes
 * "https://example.com". Relative paths, anchors and addresses with a
 * scheme stay as typed.
 *
 * @param input Typed address.
 */
export function completeHref(input: string): string {
	const value = input.trim();
	if (value === '' || SCHEME.test(value) || /^[/#?.]/.test(value)) {
		return value;
	}
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
		return 'mailto:' + value;
	}
	if (/^[^\s/]+\.[^\s/]{2,}/.test(value)) {
		return 'https://' + value;
	}
	return value;
}

/**
 * Whether the profile accepts an address as a link target.
 *
 * @param href    Address.
 * @param profile Effective profile.
 */
export function isAllowedHref(href: string, profile: Profile): boolean {
	if (href === '' || /[\s<>"]/.test(href)) {
		return false;
	}
	const nodes = parse(
		'<a href="' + href.replace(/&/g, '&amp;') + '">x</a>',
		profile,
		{
			mode: 'basic',
			links: true,
			policy: null,
		}
	).nodes;
	const link = nodes[0];
	return (
		!!link &&
		link.kind === 'element' &&
		link.name === 'a' &&
		link.attributes.some(
			([name, value]) => name === 'href' && value === href
		)
	);
}

function attributeMap(attributes: Attributes): Map<string, string> {
	return new Map(attributes.map(([name, value]) => [name, value]));
}

/**
 * The choices shown for a link: its own target and rel when it has them,
 * otherwise the site defaults.
 *
 * @param attributes Existing link attributes, or empty for a new link.
 * @param defaults   Site link defaults.
 */
export function initialChoice(
	attributes: Attributes,
	defaults: LinkDefaults
): LinkChoice {
	const map = attributeMap(attributes);
	const rel = (map.get('rel') ?? '').split(' ').filter(Boolean);
	return {
		href: map.get('href') ?? '',
		newTab: map.has('target')
			? map.get('target') === '_blank'
			: defaults.newTab,
		nofollow: map.has('rel') ? rel.includes('nofollow') : defaults.nofollow,
		newTabTouched: false,
		nofollowTouched: false,
	};
}

/**
 * Link attributes for a choice. Target and rel are written only when the
 * link already had them or the choice changed, so other links keep
 * following the site defaults.
 *
 * @param choice   The popover's values.
 * @param existing Existing link attributes, or empty for a new link.
 * @param profile  Effective profile.
 */
export function linkAttributes(
	choice: LinkChoice,
	existing: Attributes,
	profile: Profile
): Attributes {
	const specs = profile.elements.a?.attributes ?? {};
	const map = attributeMap(existing);
	map.set('href', choice.href);

	if (choice.newTabTouched) {
		map.set('target', choice.newTab ? '_blank' : '_self');
	}
	if (choice.nofollowTouched) {
		const tokens = (map.get('rel') ?? '')
			.split(' ')
			.filter((token) => token && token !== 'nofollow');
		if (choice.nofollow) {
			tokens.unshift('nofollow');
		}
		map.set('rel', tokens.join(' '));
	}

	const out: Attributes = [];
	for (const name of Object.keys(specs)) {
		if (!map.has(name)) {
			continue;
		}
		const spec = specs[name];
		const value = map.get(name) ?? '';
		if (spec.type === 'enum' && !(spec.values ?? []).includes(value)) {
			continue;
		}
		if (spec.type === 'tokens') {
			const allowed = value
				.split(' ')
				.filter((token) => (spec.values ?? []).includes(token));
			out.push([name, allowed.join(' ')]);
			continue;
		}
		out.push([name, value]);
	}
	return out;
}
