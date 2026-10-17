import {
	VOID_ELEMENTS,
	nodesToHtml,
	normalize,
	parse,
	type FormatNode,
	type Profile,
} from '../formatted-text';

/**
 * Editor document model.
 *
 * A document is a list of blocks. The only block type is a paragraph holding
 * inline content: text runs and line breaks, each carrying a set of marks.
 * A mark is an allowed element with its attributes (strong, em, a, …).
 *
 * Offsets are positions in a linear space where each UTF-16 code unit of
 * text and each line break count as one, matching DOM text offsets.
 */

export type Attributes = Array<[string, string]>;

export interface Mark {
	name: string;
	attributes: Attributes;
}

export type Inline =
	| { kind: 'text'; text: string; marks: Mark[] }
	| { kind: 'break'; marks: Mark[] };

export interface Block {
	type: 'paragraph';
	content: Inline[];
}

export interface Doc {
	blocks: Block[];
}

export interface Unit {
	/** One code unit of text, or null for a line break. */
	char: string | null;
	marks: Mark[];
}

export interface LoadResult {
	doc: Doc;
	/** True when the value holds markup the visual editor cannot show. */
	unsupported: boolean;
}

const LINK = 'a';

export function emptyDoc(): Doc {
	return { blocks: [{ type: 'paragraph', content: [] }] };
}

export function sameMark(a: Mark, b: Mark): boolean {
	if (a.name !== b.name || a.attributes.length !== b.attributes.length) {
		return false;
	}
	return a.attributes.every(
		([name, value], index) =>
			b.attributes[index][0] === name && b.attributes[index][1] === value
	);
}

function sameMarks(a: Mark[], b: Mark[]): boolean {
	return (
		a.length === b.length &&
		a.every((mark, index) => sameMark(mark, b[index]))
	);
}

/**
 * Sorts marks into nesting order: links outermost, then the profile's order.
 *
 * @param marks   Marks to sort.
 * @param profile Effective profile.
 */
export function sortMarks(marks: Mark[], profile: Profile): Mark[] {
	const order = Object.keys(profile.elements);
	const rank = (mark: Mark): number =>
		mark.name === LINK
			? -1
			: order.indexOf(mark.name) === -1
				? order.length
				: order.indexOf(mark.name);
	return [...marks].sort(
		(a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
	);
}

function canonicalMarks(marks: Mark[], profile: Profile): Mark[] {
	const out: Mark[] = [];
	for (const mark of sortMarks(marks, profile)) {
		if (!out.some((existing) => existing.name === mark.name)) {
			out.push({
				name: mark.name,
				attributes: mark.attributes.map(([n, v]) => [n, v]),
			});
		}
	}
	return out;
}

/**
 * Converts parsed nodes to a document.
 *
 * @param nodes   Nodes from the formatter.
 * @param profile Effective profile.
 */
export function fromNodes(nodes: FormatNode[], profile: Profile): LoadResult {
	const content: Inline[] = [];
	let unsupported = false;

	const walk = (list: FormatNode[], marks: Mark[]): void => {
		for (const node of list) {
			if (node.kind === 'text') {
				if (node.value !== '') {
					content.push({
						kind: 'text',
						text: node.value,
						marks: canonicalMarks(marks, profile),
					});
				}
			} else if (node.kind === 'break') {
				content.push({
					kind: 'break',
					marks: canonicalMarks(marks, profile),
				});
			} else if (
				VOID_ELEMENTS.includes(node.name) ||
				!profile.elements[node.name]
			) {
				unsupported = true;
			} else if (marks.some((mark) => mark.name === node.name)) {
				walk(node.children, marks);
			} else {
				walk(node.children, [
					...marks,
					{ name: node.name, attributes: node.attributes },
				]);
			}
		}
	};
	walk(nodes, []);

	return {
		doc: {
			blocks: [{ type: 'paragraph', content: mergeInlines(content) }],
		},
		unsupported,
	};
}

/**
 * Loads a stored value into a document.
 *
 * @param value   Stored caption or description.
 * @param profile Effective profile.
 */
export function load(value: string, profile: Profile): LoadResult {
	const result = parse(value, profile, {
		mode: 'basic',
		links: true,
		policy: null,
	});
	const loaded = fromNodes(result.nodes, profile);
	return { doc: loaded.doc, unsupported: loaded.unsupported || result.lossy };
}

/**
 * Reads editable markup back into a document, keeping spaces and breaks
 * exactly where the user typed them.
 *
 * @param html    Markup of the editing area.
 * @param profile Effective profile.
 */
export function read(html: string, profile: Profile): Doc {
	const result = parse(html, profile, {
		mode: 'basic',
		links: true,
		policy: null,
		tidy: false,
	});
	return fromNodes(result.nodes, profile).doc;
}

function mergeInlines(content: Inline[]): Inline[] {
	const out: Inline[] = [];
	for (const inline of content) {
		const last = out[out.length - 1];
		if (
			inline.kind === 'text' &&
			last &&
			last.kind === 'text' &&
			sameMarks(last.marks, inline.marks)
		) {
			last.text += inline.text;
		} else if (inline.kind !== 'text' || inline.text !== '') {
			out.push(inline);
		}
	}
	return out;
}

export function inlines(doc: Doc): Inline[] {
	return doc.blocks.flatMap((block) => block.content);
}

/**
 * Builds formatter nodes for a document, nesting marks consistently.
 *
 * @param doc     Document.
 * @param profile Effective profile.
 */
export function toNodes(doc: Doc, profile: Profile): FormatNode[] {
	const root: FormatNode[] = [];
	const stack: Array<{ mark: Mark; children: FormatNode[] }> = [];

	const top = (): FormatNode[] =>
		stack.length ? stack[stack.length - 1].children : root;

	for (const inline of inlines(doc)) {
		const marks = sortMarks(inline.marks, profile);
		let common = 0;
		while (
			common < stack.length &&
			common < marks.length &&
			sameMark(stack[common].mark, marks[common])
		) {
			common++;
		}
		stack.length = common;
		for (let i = common; i < marks.length; i++) {
			const element: FormatNode = {
				kind: 'element',
				name: marks[i].name,
				attributes: marks[i].attributes.map(([n, v]) => [n, v]),
				children: [],
			};
			top().push(element);
			stack.push({ mark: marks[i], children: element.children });
		}
		if (inline.kind === 'text') {
			const parent = top();
			const previous = parent[parent.length - 1];
			if (previous && previous.kind === 'text') {
				previous.value += inline.text;
			} else {
				parent.push({ kind: 'text', value: inline.text });
			}
		} else {
			top().push({ kind: 'break' });
		}
	}
	return root;
}

/**
 * Serializes a document to its stored form: allowed markup with "\n" for
 * line breaks, tidied the same way stored text is.
 *
 * @param doc     Document.
 * @param profile Effective profile.
 */
export function serialize(doc: Doc, profile: Profile): string {
	return normalize(nodesToHtml(toNodes(doc, profile), true), profile).html;
}

export function toUnits(doc: Doc): Unit[] {
	const units: Unit[] = [];
	for (const inline of inlines(doc)) {
		if (inline.kind === 'break') {
			units.push({ char: null, marks: inline.marks });
		} else {
			for (let i = 0; i < inline.text.length; i++) {
				units.push({ char: inline.text[i], marks: inline.marks });
			}
		}
	}
	return units;
}

export function fromUnits(units: Unit[], profile: Profile): Doc {
	const content: Inline[] = units.map((unit) =>
		unit.char === null
			? { kind: 'break', marks: canonicalMarks(unit.marks, profile) }
			: {
					kind: 'text',
					text: unit.char,
					marks: canonicalMarks(unit.marks, profile),
				}
	);
	return { blocks: [{ type: 'paragraph', content: mergeInlines(content) }] };
}

export function docLength(doc: Doc): number {
	return inlines(doc).reduce(
		(total, inline) =>
			total + (inline.kind === 'break' ? 1 : inline.text.length),
		0
	);
}

export function endsWithBreak(doc: Doc): boolean {
	const all = inlines(doc);
	return all.length > 0 && all[all.length - 1].kind === 'break';
}

export function docText(doc: Doc): string {
	return inlines(doc)
		.map((inline) => (inline.kind === 'break' ? '\n' : inline.text))
		.join('');
}
