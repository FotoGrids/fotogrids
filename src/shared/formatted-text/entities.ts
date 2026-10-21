const ENTITY_PATTERN =
	/&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g;

const COMMON_NAMED: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

const namedCache = new Map<string, string | null>();
let decoderDocument: Document | null = null;

function decodeNamed(name: string): string | null {
	if (Object.prototype.hasOwnProperty.call(COMMON_NAMED, name)) {
		return COMMON_NAMED[name];
	}
	if (namedCache.has(name)) {
		return namedCache.get(name) ?? null;
	}
	let decoded: string | null = null;
	if (typeof DOMParser !== 'undefined') {
		if (!decoderDocument) {
			decoderDocument = new DOMParser().parseFromString('', 'text/html');
		}
		const area = decoderDocument.createElement('textarea');
		area.innerHTML = '&' + name + ';';
		const value = area.value;
		const partial = value.length > 1 && value.endsWith(';');
		decoded = value === '&' + name + ';' || partial ? null : value;
	}
	namedCache.set(name, decoded);
	return decoded;
}

function decodeNumeric(body: string): string {
	const code =
		body[1] === 'x' || body[1] === 'X'
			? parseInt(body.slice(2), 16)
			: parseInt(body.slice(1), 10);
	if (
		!Number.isFinite(code) ||
		code === 0 ||
		code > 0x10ffff ||
		(code >= 0xd800 && code <= 0xdfff)
	) {
		return '�';
	}
	return String.fromCodePoint(code);
}

/**
 * Decodes character references that end in a semicolon.
 *
 * Numeric references are decoded here; named ones through the HTML5 table of
 * an inert document. References without a semicolon stay as written.
 *
 * @param value Text or attribute value.
 */
export function decodeEntities(value: string): string {
	if (value.indexOf('&') === -1) {
		return value;
	}
	return value.replace(ENTITY_PATTERN, (match: string, body: string) => {
		if (body[0] === '#') {
			return decodeNumeric(body);
		}
		const named = decodeNamed(body);
		return named === null ? match : named;
	});
}

/**
 * Escapes text for an HTML text node.
 *
 * @param value Plain text.
 */
export function escapeText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Escapes text for a double-quoted HTML attribute value.
 *
 * @param value Plain text.
 */
export function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}
