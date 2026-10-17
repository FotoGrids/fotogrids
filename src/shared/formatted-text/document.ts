import { tokenize } from './tokenize';
import {
	FLOOR,
	isFloorAttribute,
	type AttributeSpec,
	type Profile,
} from './schema';

export type FormatNode =
	| { kind: 'text'; value: string }
	| { kind: 'break' }
	| {
			kind: 'element';
			name: string;
			attributes: Array<[string, string]>;
			children: FormatNode[];
	  };

export interface LinkPolicy {
	newTab: boolean;
	rel: string[];
}

export interface FormatOptions {
	mode?: 'basic' | 'plain';
	links?: boolean;
	policy?: LinkPolicy | null;
	newTabLabel?: string;
	maxLength?: number;
	/**
	 * Trim leading and trailing space and collapse runs of breaks. Editors
	 * turn it off while the user types; stored and displayed text keeps it on.
	 */
	tidy?: boolean;
}

export interface ParseResult {
	nodes: FormatNode[];
	lossy: boolean;
}

export const SCREEN_READER_CLASS = 'fg-formatted-text-sr';

/** Deepest nesting of allowed elements; deeper ones are unwrapped. */
export const MAX_DEPTH = 16;

export const VOID_ELEMENTS = [
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr',
];

type StreamItem =
	| { t: 'text'; v: string }
	| { t: 'br' }
	| { t: 'open'; name: string; attributes: Array<[string, string]> }
	| { t: 'close'; name: string };

// Link types the formatter adds itself; dropping them loses nothing.
const IMPLIED_REL = ['noopener', 'noreferrer'];

const URL_CONTROL = /[\u0000- \u007f-\u009f]/g;
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const ASCII_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

function isAllowedUrl(value: string, protocols: string[]): boolean {
	const compact = value.replace(URL_CONTROL, '');
	if (compact === '') {
		return false;
	}
	const scheme = SCHEME.exec(compact);
	if (!scheme) {
		return true;
	}
	return protocols.includes(scheme[1].toLowerCase());
}

function sanitizeAttributes(
	attributes: Array<[string, string]>,
	specs: Record<string, AttributeSpec>,
	protocols: string[]
): { attributes: Array<[string, string]>; lossy: boolean } {
	const given = new Map(attributes);
	let lossy = false;

	for (const [name] of attributes) {
		if (
			isFloorAttribute(name) ||
			!Object.prototype.hasOwnProperty.call(specs, name)
		) {
			lossy = true;
		}
	}

	const out: Array<[string, string]> = [];
	for (const [name, spec] of Object.entries(specs)) {
		if (!given.has(name)) {
			continue;
		}
		const raw = given.get(name) ?? '';
		if (spec.type === 'url') {
			const value = raw.replace(ASCII_SPACE, '');
			if (isAllowedUrl(value, protocols)) {
				out.push([name, value]);
			} else {
				lossy = true;
			}
		} else if (spec.type === 'enum') {
			const value = raw.replace(ASCII_SPACE, '').toLowerCase();
			if ((spec.values ?? []).includes(value)) {
				out.push([name, value]);
			} else {
				lossy = true;
			}
		} else if (spec.type === 'tokens') {
			const tokens: string[] = [];
			let implied = false;
			for (const token of raw.toLowerCase().split(/[\t\n\f\r ]+/)) {
				if (token === '') {
					continue;
				}
				if ((spec.values ?? []).includes(token)) {
					if (!tokens.includes(token)) {
						tokens.push(token);
					}
				} else if (name === 'rel' && IMPLIED_REL.includes(token)) {
					implied = true;
				} else {
					lossy = true;
				}
			}
			if (tokens.length > 0 || !implied) {
				out.push([name, tokens.join(' ')]);
			}
		} else {
			out.push([
				name,
				raw.replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, ''),
			]);
		}
	}
	return { attributes: out, lossy };
}

function applyLinkPolicy(
	attributes: Array<[string, string]>,
	policy: LinkPolicy,
	specs: Record<string, AttributeSpec>
): Array<[string, string]> {
	const current = new Map(attributes);
	if (!current.has('target') && policy.newTab) {
		current.set('target', '_blank');
	}
	let rel: string[] = current.has('rel')
		? (current.get('rel') ?? '').split(' ').filter(Boolean)
		: policy.rel.filter((token) => FLOOR.linkRel.includes(token));
	if (current.get('target') === '_blank' && !rel.includes('noopener')) {
		rel = [...rel, 'noopener'];
	}
	if (rel.length > 0) {
		current.set('rel', rel.join(' '));
	} else {
		current.delete('rel');
	}

	const order = Object.keys(specs);
	for (const name of ['target', 'rel']) {
		if (!order.includes(name)) {
			order.push(name);
		}
	}
	const out: Array<[string, string]> = [];
	for (const name of order) {
		if (current.has(name)) {
			out.push([name, current.get(name) ?? '']);
		}
	}
	return out;
}

function buildStream(
	raw: string,
	profile: Profile,
	options: Required<Pick<FormatOptions, 'mode' | 'links'>> & {
		policy: LinkPolicy | null;
	}
): { stream: StreamItem[]; lossy: boolean } {
	const tokens = tokenize(raw, FLOOR.rawText);
	const stream: StreamItem[] = [];
	const open: string[] = [];
	const plain = options.mode === 'plain';
	const dropWithContent = new Set([
		...profile.dropWithContent,
		...FLOOR.rawText,
	]);
	const breakBefore = new Set(profile.breakBefore);
	let lossy = false;
	let dropping: string | null = null;
	let dropDepth = 0;

	const isAllowed = (name: string): boolean =>
		!plain &&
		name !== 'br' &&
		Object.prototype.hasOwnProperty.call(profile.elements, name);

	const closeTo = (index: number): void => {
		while (open.length > index) {
			const name = open.pop() as string;
			stream.push({ t: 'close', name });
		}
	};

	const pushText = (value: string): void => {
		const parts = value.split('\n');
		parts.forEach((part, index) => {
			if (index > 0) {
				stream.push({ t: 'br' });
			}
			if (part !== '') {
				stream.push({ t: 'text', v: part });
			}
		});
	};

	for (const token of tokens) {
		if (token.type === 'dropped') {
			lossy = true;
			continue;
		}

		if (dropping !== null) {
			if (
				token.type === 'start' &&
				token.name === dropping &&
				!VOID_ELEMENTS.includes(token.name)
			) {
				dropDepth++;
			} else if (token.type === 'end' && token.name === dropping) {
				dropDepth--;
				if (dropDepth === 0) {
					dropping = null;
				}
			}
			continue;
		}

		if (token.type === 'text') {
			pushText(token.value);
			continue;
		}

		const name = token.name;

		if (name === 'br') {
			if (token.type === 'start' && token.attributes.length > 0) {
				lossy = true;
			}
			stream.push({ t: 'br' });
			continue;
		}

		if (token.type === 'start') {
			if (isAllowed(name)) {
				const specs = profile.elements[name].attributes ?? {};
				const clean = sanitizeAttributes(
					token.attributes,
					specs,
					profile.protocols
				);
				lossy = lossy || clean.lossy;
				let attributes = clean.attributes;

				if (name === 'a') {
					const outer = open.lastIndexOf('a');
					if (outer !== -1) {
						lossy = true;
						closeTo(outer);
					}
					if (!attributes.some(([attr]) => attr === 'href')) {
						lossy = true;
						continue;
					}
					if (!options.links) {
						continue;
					}
					if (options.policy) {
						attributes = applyLinkPolicy(
							attributes,
							options.policy,
							specs
						);
					}
				}

				if (VOID_ELEMENTS.includes(name)) {
					stream.push({ t: 'open', name, attributes });
					stream.push({ t: 'close', name });
					continue;
				}
				if (open.length >= MAX_DEPTH) {
					lossy = true;
					continue;
				}
				stream.push({ t: 'open', name, attributes });
				open.push(name);
				continue;
			}

			lossy = true;
			if (
				dropWithContent.has(name) &&
				!token.selfClosing &&
				!VOID_ELEMENTS.includes(name)
			) {
				dropping = name;
				dropDepth = 1;
				continue;
			}
			if (breakBefore.has(name)) {
				stream.push({ t: 'br' });
			}
			continue;
		}

		const index = open.lastIndexOf(name);
		if (index !== -1) {
			closeTo(index);
			continue;
		}
		if (breakBefore.has(name)) {
			stream.push({ t: 'br' });
		}
		lossy = true;
	}

	closeTo(0);
	return { stream, lossy };
}

function adjacentText(
	stream: StreamItem[],
	from: number,
	step: number
): number {
	for (let i = from; i >= 0 && i < stream.length; i += step) {
		const item = stream[i];
		if (item.t === 'text') {
			return i;
		}
		if (item.t === 'br') {
			return -1;
		}
	}
	return -1;
}

function tidyBreaks(stream: StreamItem[]): StreamItem[] {
	stream.forEach((item, index) => {
		if (item.t !== 'br') {
			return;
		}
		const before = adjacentText(stream, index - 1, -1);
		if (before !== -1) {
			const text = stream[before] as { t: 'text'; v: string };
			text.v = text.v.replace(/[\t ]+$/, '');
		}
		const after = adjacentText(stream, index + 1, 1);
		if (after !== -1) {
			const text = stream[after] as { t: 'text'; v: string };
			text.v = text.v.replace(/^[\t ]+/, '');
		}
	});

	const out: StreamItem[] = [];
	let run = 0;
	let seenText = false;
	for (const item of stream) {
		if (item.t === 'text') {
			if (item.v === '') {
				continue;
			}
			run = 0;
			seenText = true;
			out.push(item);
		} else if (item.t === 'br') {
			if (!seenText) {
				continue;
			}
			run++;
			if (run <= 2) {
				out.push(item);
			}
		} else {
			out.push(item);
		}
	}

	for (let i = out.length - 1; i >= 0; i--) {
		const item = out[i];
		if (item.t === 'text') {
			break;
		}
		if (item.t === 'br') {
			out.splice(i, 1);
		}
	}

	const first = out.findIndex((item) => item.t === 'text');
	if (first !== -1) {
		const text = out[first] as { t: 'text'; v: string };
		text.v = text.v.replace(/^[\t\n\f\r ]+/, '');
	}
	let last = -1;
	for (let i = out.length - 1; i >= 0; i--) {
		if (out[i].t === 'text') {
			last = i;
			break;
		}
	}
	if (last !== -1) {
		const text = out[last] as { t: 'text'; v: string };
		text.v = text.v.replace(/[\t\n\f\r ]+$/, '');
	}
	return out.filter((item) => item.t !== 'text' || item.v !== '');
}

function toTree(stream: StreamItem[]): FormatNode[] {
	const root: FormatNode[] = [];
	const stack: FormatNode[][] = [root];
	for (const item of stream) {
		const parent = stack[stack.length - 1];
		if (item.t === 'text') {
			const previous = parent[parent.length - 1];
			if (previous && previous.kind === 'text') {
				previous.value += item.v;
			} else {
				parent.push({ kind: 'text', value: item.v });
			}
		} else if (item.t === 'br') {
			parent.push({ kind: 'break' });
		} else if (item.t === 'open') {
			const element: FormatNode = {
				kind: 'element',
				name: item.name,
				attributes: item.attributes,
				children: [],
			};
			parent.push(element);
			stack.push(element.children);
		} else if (stack.length > 1) {
			stack.pop();
		}
	}
	return root;
}

function hasVisibleText(nodes: FormatNode[]): boolean {
	return nodes.some((node) => {
		if (node.kind === 'text') {
			return node.value.replace(/[\t\n\f\r ]+/g, '') !== '';
		}
		if (node.kind === 'element') {
			return hasVisibleText(node.children);
		}
		return false;
	});
}

function cleanTree(nodes: FormatNode[]): FormatNode[] {
	const out: FormatNode[] = [];
	for (const node of nodes) {
		if (node.kind !== 'element') {
			out.push(node);
			continue;
		}
		node.children = cleanTree(node.children);
		if (VOID_ELEMENTS.includes(node.name)) {
			out.push(node);
			continue;
		}
		if (node.children.length === 0) {
			continue;
		}
		if (node.name === 'a' && !hasVisibleText(node.children)) {
			out.push(...node.children);
			continue;
		}
		out.push(node);
	}
	return out;
}

function truncateNodes(nodes: FormatNode[], max: number): FormatNode[] {
	let remaining = max;
	let cut = false;

	const walk = (list: FormatNode[]): FormatNode[] => {
		const out: FormatNode[] = [];
		for (const node of list) {
			if (cut) {
				break;
			}
			if (node.kind === 'text') {
				const chars = Array.from(node.value);
				if (chars.length <= remaining) {
					remaining -= chars.length;
					out.push(node);
				} else {
					if (remaining > 0) {
						out.push({
							kind: 'text',
							value: chars.slice(0, remaining).join('') + '…',
						});
					}
					remaining = 0;
					cut = true;
				}
			} else if (node.kind === 'break') {
				if (remaining >= 1) {
					remaining -= 1;
					out.push(node);
				} else {
					cut = true;
				}
			} else {
				const children = walk(node.children);
				if (children.length > 0 || VOID_ELEMENTS.includes(node.name)) {
					out.push({ ...node, children });
				}
			}
		}
		return out;
	};

	const total = countUnits(nodes);
	if (total <= max) {
		return nodes;
	}
	const result = walk(nodes);
	if (!endsWithEllipsis(result)) {
		trimTrailingBreaks(result);
		appendEllipsis(result);
	}
	return result;
}

function countUnits(nodes: FormatNode[]): number {
	let total = 0;
	for (const node of nodes) {
		if (node.kind === 'text') {
			total += Array.from(node.value).length;
		} else if (node.kind === 'break') {
			total += 1;
		} else {
			total += countUnits(node.children);
		}
	}
	return total;
}

function lastText(nodes: FormatNode[]): { kind: 'text'; value: string } | null {
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i];
		if (node.kind === 'text') {
			return node;
		}
		if (node.kind === 'element') {
			const inner = lastText(node.children);
			if (inner) {
				return inner;
			}
		}
		if (node.kind === 'break') {
			return null;
		}
	}
	return null;
}

function endsWithEllipsis(nodes: FormatNode[]): boolean {
	const text = lastText(nodes);
	return text !== null && text.value.endsWith('…');
}

function trimTrailingBreaks(nodes: FormatNode[]): void {
	while (nodes.length > 0) {
		const last = nodes[nodes.length - 1];
		if (last.kind === 'break') {
			nodes.pop();
			continue;
		}
		if (last.kind === 'element' && !VOID_ELEMENTS.includes(last.name)) {
			trimTrailingBreaks(last.children);
			if (last.children.length === 0) {
				nodes.pop();
				continue;
			}
		}
		break;
	}
}

function appendEllipsis(nodes: FormatNode[]): void {
	const text = lastText(nodes);
	if (text) {
		text.value += '…';
	} else {
		nodes.push({ kind: 'text', value: '…' });
	}
}

function addScreenReaderText(nodes: FormatNode[], label: string): void {
	for (const node of nodes) {
		if (node.kind !== 'element') {
			continue;
		}
		addScreenReaderText(node.children, label);
		if (
			node.name === 'a' &&
			node.attributes.some(
				([name, value]) => name === 'target' && value === '_blank'
			)
		) {
			node.children.push({
				kind: 'element',
				name: 'span',
				attributes: [['class', SCREEN_READER_CLASS]],
				children: [{ kind: 'text', value: ' ' + label }],
			});
		}
	}
}

/**
 * Parses markup into a sanitized node tree.
 *
 * @param raw     Stored caption or description.
 * @param profile Effective profile.
 * @param options Mode, link and length options.
 */
export function parse(
	raw: string,
	profile: Profile,
	options: FormatOptions = {}
): ParseResult {
	const mode = options.mode === 'plain' ? 'plain' : 'basic';
	const links = options.links !== false;
	const policy = options.policy ?? null;
	const tidy = options.tidy !== false;
	const input = String(raw ?? '').replace(/\r\n?/g, '\n');

	if (
		tidy &&
		input.indexOf('<') === -1 &&
		input.indexOf('&') === -1 &&
		input.indexOf('\n') === -1
	) {
		const value = input.replace(/^[\t\f\r ]+|[\t\f\r ]+$/g, '');
		let nodes: FormatNode[] = value === '' ? [] : [{ kind: 'text', value }];
		if (options.maxLength && options.maxLength > 0) {
			nodes = truncateNodes(nodes, options.maxLength);
		}
		return { nodes, lossy: false };
	}

	const { stream, lossy } = buildStream(input, profile, {
		mode,
		links,
		policy,
	});
	let nodes = cleanTree(
		toTree(
			tidy
				? tidyBreaks(stream)
				: stream.filter((item) => item.t !== 'text' || item.v !== '')
		)
	);
	if (options.maxLength && options.maxLength > 0) {
		nodes = truncateNodes(nodes, options.maxLength);
	}
	if (policy && options.newTabLabel) {
		addScreenReaderText(nodes, options.newTabLabel);
	}
	return { nodes, lossy };
}
