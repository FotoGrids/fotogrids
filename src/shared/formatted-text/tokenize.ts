import { decodeEntities } from './entities';

export type Token =
	| { type: 'text'; value: string }
	| {
			type: 'start';
			name: string;
			attributes: Array<[string, string]>;
			selfClosing: boolean;
	  }
	| { type: 'end'; name: string }
	| { type: 'dropped' };

const WHITESPACE = /[\t\n\f\r ]/;
const TAG_NAME_START = /[A-Za-z]/;

function isWhitespace(char: string): boolean {
	return WHITESPACE.test(char);
}

function readName(input: string, from: number): [string, number] {
	let end = from;
	while (
		end < input.length &&
		!isWhitespace(input[end]) &&
		input[end] !== '/' &&
		input[end] !== '>'
	) {
		end++;
	}
	return [input.slice(from, end).toLowerCase(), end];
}

/**
 * Reads a start tag beginning at `from` (the character after `<`).
 *
 * Returns null when the input ends inside the tag.
 */
function readStartTag(
	input: string,
	from: number
): { token: Token; next: number } | null {
	const [name, afterName] = readName(input, from);
	const attributes: Array<[string, string]> = [];
	const seen = new Set<string>();
	let i = afterName;
	let selfClosing = false;

	while (i < input.length) {
		const char = input[i];
		if (isWhitespace(char)) {
			i++;
			continue;
		}
		if (char === '>') {
			return {
				token: { type: 'start', name, attributes, selfClosing },
				next: i + 1,
			};
		}
		if (char === '/') {
			selfClosing = input[i + 1] === '>';
			i++;
			continue;
		}
		selfClosing = false;

		let nameEnd = i + 1;
		while (
			nameEnd < input.length &&
			!isWhitespace(input[nameEnd]) &&
			input[nameEnd] !== '/' &&
			input[nameEnd] !== '>' &&
			input[nameEnd] !== '='
		) {
			nameEnd++;
		}
		const attrName = input.slice(i, nameEnd).toLowerCase();
		i = nameEnd;
		while (i < input.length && isWhitespace(input[i])) {
			i++;
		}

		let value = '';
		if (input[i] === '=') {
			i++;
			while (i < input.length && isWhitespace(input[i])) {
				i++;
			}
			const quote = input[i];
			if (quote === '"' || quote === "'") {
				const close = input.indexOf(quote, i + 1);
				if (close === -1) {
					return null;
				}
				value = input.slice(i + 1, close);
				i = close + 1;
			} else {
				let valueEnd = i;
				while (
					valueEnd < input.length &&
					!isWhitespace(input[valueEnd]) &&
					input[valueEnd] !== '>'
				) {
					valueEnd++;
				}
				value = input.slice(i, valueEnd);
				i = valueEnd;
			}
		}

		if (!seen.has(attrName)) {
			seen.add(attrName);
			attributes.push([attrName, decodeEntities(value)]);
		}
	}
	return null;
}

function findRawTextEnd(input: string, from: number, name: string): number {
	const pattern = new RegExp('</' + name + '(?=[\\t\\n\\f\\r />]|$)', 'gi');
	pattern.lastIndex = from;
	const match = pattern.exec(input);
	return match ? match.index : input.length;
}

/**
 * Splits markup into tokens without building a tree.
 *
 * The tokenizer is deliberately forgiving: anything it cannot read as a tag
 * becomes text, comments and declarations become `dropped` tokens, and the
 * content of raw-text elements is skipped. Attribute values and text are
 * returned decoded.
 *
 * @param input   Markup.
 * @param rawText Lower-case names of elements whose content is not markup.
 */
export function tokenize(input: string, rawText: string[]): Token[] {
	const tokens: Token[] = [];
	const raw = new Set(rawText);
	let text = '';
	let i = 0;

	const flushText = (): void => {
		if (text !== '') {
			tokens.push({ type: 'text', value: decodeEntities(text) });
			text = '';
		}
	};

	while (i < input.length) {
		const char = input[i];
		if (char !== '<') {
			const next = input.indexOf('<', i);
			const end = next === -1 ? input.length : next;
			text += input.slice(i, end);
			i = end;
			continue;
		}

		const following = input[i + 1] ?? '';

		if (input.startsWith('<!--', i)) {
			flushText();
			const close = input.indexOf('-->', i + 4);
			i = close === -1 ? input.length : close + 3;
			tokens.push({ type: 'dropped' });
			continue;
		}

		if (following === '!' || following === '?') {
			flushText();
			const close = input.indexOf('>', i + 2);
			i = close === -1 ? input.length : close + 1;
			tokens.push({ type: 'dropped' });
			continue;
		}

		if (following === '/' && TAG_NAME_START.test(input[i + 2] ?? '')) {
			flushText();
			const [name] = readName(input, i + 2);
			const close = input.indexOf('>', i + 2);
			i = close === -1 ? input.length : close + 1;
			tokens.push({ type: 'end', name });
			continue;
		}

		if (TAG_NAME_START.test(following)) {
			const tag = readStartTag(input, i + 1);
			flushText();
			if (tag === null) {
				tokens.push({ type: 'dropped' });
				break;
			}
			tokens.push(tag.token);
			i = tag.next;
			const start = tag.token as Extract<Token, { type: 'start' }>;
			if (raw.has(start.name)) {
				const end = findRawTextEnd(input, i, start.name);
				if (end > i) {
					tokens.push({ type: 'dropped' });
				}
				i = end;
			}
			continue;
		}

		text += '<';
		i++;
	}

	flushText();
	return tokens;
}
