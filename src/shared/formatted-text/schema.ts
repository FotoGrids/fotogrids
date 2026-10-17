import schemaFile from './schema.json';

export type AttributeType = 'url' | 'text' | 'enum' | 'tokens';

export interface AttributeSpec {
	type: AttributeType;
	values?: string[];
}

export interface ElementSpec {
	attributes?: Record<string, AttributeSpec>;
}

export interface Profile {
	elements: Record<string, ElementSpec>;
	protocols: string[];
	breakBefore: string[];
	dropWithContent: string[];
}

export interface Floor {
	elements: string[];
	attributePrefixes: string[];
	attributes: string[];
	urlAttributes: string[];
	rawText: string[];
	linkRel: string[];
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*$/;
const ATTRIBUTE_TYPES: AttributeType[] = ['url', 'text', 'enum', 'tokens'];

export const FLOOR: Floor = schemaFile.floor as Floor;

export const DEFAULT_PROFILE = 'item_text';

const bundledCache = new Map<string, Profile>();

/**
 * Returns the bundled profile definition, validated against the floor.
 *
 * @param name Profile name.
 */
export function bundledProfile(name: string = DEFAULT_PROFILE): Profile {
	const cached = bundledCache.get(name);
	if (cached) {
		return cached;
	}
	const profiles = schemaFile.profiles as Record<string, unknown>;
	const profile = validateProfile(
		profiles[name] ?? profiles[DEFAULT_PROFILE]
	);
	bundledCache.set(name, profile);
	return profile;
}

/**
 * Whether an attribute name is banned by the floor.
 *
 * @param name Lower-case attribute name.
 */
export function isFloorAttribute(name: string): boolean {
	if (FLOOR.attributes.includes(name)) {
		return true;
	}
	return FLOOR.attributePrefixes.some((prefix) => name.startsWith(prefix));
}

function stringList(value: unknown, pattern: RegExp): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const out: string[] = [];
	for (const entry of value) {
		if (typeof entry !== 'string') {
			continue;
		}
		const lower = entry.trim().toLowerCase();
		if (pattern.test(lower) && !out.includes(lower)) {
			out.push(lower);
		}
	}
	return out;
}

function validateAttribute(name: string, raw: unknown): AttributeSpec | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}
	const spec = raw as Record<string, unknown>;
	let type = spec.type as AttributeType;
	if (!ATTRIBUTE_TYPES.includes(type)) {
		return null;
	}
	if (FLOOR.urlAttributes.includes(name)) {
		type = 'url';
	}
	if (type === 'enum' || type === 'tokens') {
		const values = Array.isArray(spec.values)
			? spec.values.filter(
					(value): value is string =>
						typeof value === 'string' && value.trim() !== ''
				)
			: [];
		const clean = values
			.map((value) => value.trim().toLowerCase())
			.filter((value, index, all) => all.indexOf(value) === index);
		if (clean.length === 0) {
			return null;
		}
		return { type, values: clean };
	}
	return { type };
}

/**
 * Validates a profile definition and applies the floor to it.
 *
 * Unknown keys are dropped, names are checked against a strict pattern,
 * and anything the floor bans is removed whatever the input says.
 *
 * @param raw Profile definition from the bundled file or the server.
 */
export function validateProfile(raw: unknown): Profile {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
		string,
		unknown
	>;
	const elements: Record<string, ElementSpec> = {};
	const rawElements =
		input.elements && typeof input.elements === 'object'
			? (input.elements as Record<string, unknown>)
			: {};

	for (const [rawName, rawSpec] of Object.entries(rawElements)) {
		const name = rawName.trim().toLowerCase();
		if (!NAME_PATTERN.test(name) || FLOOR.elements.includes(name)) {
			continue;
		}
		const spec: ElementSpec = {};
		const rawAttributes =
			rawSpec &&
			typeof rawSpec === 'object' &&
			(rawSpec as Record<string, unknown>).attributes &&
			typeof (rawSpec as Record<string, unknown>).attributes === 'object'
				? ((rawSpec as Record<string, unknown>).attributes as Record<
						string,
						unknown
					>)
				: {};
		const attributes: Record<string, AttributeSpec> = {};
		for (const [rawAttr, rawAttrSpec] of Object.entries(rawAttributes)) {
			const attr = rawAttr.trim().toLowerCase();
			if (!NAME_PATTERN.test(attr) || isFloorAttribute(attr)) {
				continue;
			}
			const attrSpec = validateAttribute(attr, rawAttrSpec);
			if (attrSpec) {
				attributes[attr] = attrSpec;
			}
		}
		if (Object.keys(attributes).length > 0) {
			spec.attributes = attributes;
		}
		elements[name] = spec;
	}

	return {
		elements,
		protocols: stringList(input.protocols, PROTOCOL_PATTERN).filter(
			(protocol) => !['javascript', 'vbscript', 'data'].includes(protocol)
		),
		breakBefore: stringList(input.breakBefore, NAME_PATTERN),
		dropWithContent: stringList(input.dropWithContent, NAME_PATTERN),
	};
}
