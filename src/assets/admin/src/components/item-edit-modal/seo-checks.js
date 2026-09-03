/**
 * Per-item SEO and accessibility checks for the Edit Item modal.
 *
 * Every result is derived from the form state and the attachment data already
 * loaded into the modal, so the SEO tab never issues its own request.
 */

export const CHECK_PASS = 'pass';
export const CHECK_WARN = 'warn';
export const CHECK_FAIL = 'fail';
export const CHECK_INFO = 'info';

const ALT_MAX_LENGTH = 125;
const ALT_MIN_WORDS = 3;
const FILENAME_MIN_WORDS = 2;
const TOKEN_PREFIX_LENGTH = 4;
const HEAVY_FILE_BYTES = 1024 * 1024;
const LARGE_EDGE_PIXELS = 3000;

const SIZE_UNITS = {
	b: 1,
	kb: 1024,
	mb: 1024 * 1024,
	gb: 1024 * 1024 * 1024,
	tb: 1024 * 1024 * 1024 * 1024,
};

const NOISE_FILENAME_TOKENS = new Set([
	'a',
	'an',
	'and',
	'at',
	'by',
	'for',
	'in',
	'of',
	'on',
	'the',
	'to',
	'with',
	'img',
	'image',
	'images',
	'photo',
	'photos',
	'pic',
	'pics',
	'picture',
	'pictures',
	'file',
	'files',
	'asset',
	'assets',
	'item',
	'default',
	'sample',
	'test',
	'temp',
	'tmp',
	'untitled',
	'unnamed',
	'noname',
	'new',
	'old',
	'copy',
	'duplicate',
	'final',
	'finals',
	'edit',
	'edited',
	'edits',
	'draft',
	'proof',
	'version',
	'ver',
	'crop',
	'cropped',
	'resize',
	'resized',
	'scale',
	'scaled',
	'rotated',
	'export',
	'exported',
	'output',
	'render',
	'rendered',
	'processed',
	'download',
	'downloaded',
	'upload',
	'uploaded',
	'save',
	'saved',
	'web',
	'webready',
	'ready',
	'small',
	'medium',
	'large',
	'min',
	'max',
	'thumb',
	'thumbnail',
	'screenshot',
	'screen',
	'shot',
	'capture',
	'snap',
	'pexels',
	'unsplash',
	'shutterstock',
	'istock',
	'istockphoto',
	'adobestock',
	'depositphotos',
	'freepik',
	'gettyimages',
	'stock',
	'demo',
	'demos',
	'example',
	'examples',
	'mockup',
	'placeholder',
	'dummy',
	'preview',
	'template',
	'slide',
	'slides',
]);

// Each digit-terminated pattern tolerates trailing counter groups so that the
// WordPress duplicate suffix in DSC_1234-1 does not defeat the match.
const GENERIC_FILENAME_PATTERNS = [
	/^(img|dsc|dscn|dscf|pxl|gopr|dji|mvimg|photo|image|untitled|scan|file|download)[-_\s]?\d+([-_]\d+)*$/i,
	/^_mg[-_\s]?\d+([-_]\d+)*$/i,
	/^p\d{7,}([-_]\d+)*$/i,
	/^screen[-_\s]?shot[-_\s]/i,
	/^screenshot[-_\s]/i,
	/^\d+([-_]\d+)*$/,
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i,
	/^[0-9a-f]{24,}([-_]\d+)*$/i,
];

const text = (value) => String(value ?? '').trim();

const wordCount = (value) => text(value).split(/\s+/).filter(Boolean).length;

const filenameStem = (filename) => text(filename).replace(/\.[^.]+$/, '');

/**
 * Removes trailing sequence and duplicate counters from a filename stem.
 *
 * WordPress appends -1, -2 to a re-uploaded name and export tools append their
 * own runs, so DSC_1234-1 has to reduce to DSC_1234 before any pattern match.
 *
 * @param {string} stem Filename stem.
 * @return {string} Stem without its trailing counters.
 */
const stripCounterSuffix = (stem) => stem.replace(/([-_]\d+)+$/, '');

const normalizeForCompare = (value) =>
	text(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');

/**
 * Converts a `size_format()` string such as "2.4 MB" into bytes.
 *
 * @param {string} value Human-readable size from the item endpoint.
 * @return {number|null} Bytes, or null when the string is not parseable.
 */
const parseFileSize = (value) => {
	const match = /^([\d.,]+)\s*(B|KB|MB|GB|TB)$/i.exec(text(value));

	if (!match) {
		return null;
	}

	const amount = parseFloat(match[1].replace(',', '.'));
	const unit = SIZE_UNITS[match[2].toLowerCase()];

	if (!Number.isFinite(amount) || !unit) {
		return null;
	}

	return amount * unit;
};

/**
 * Splits text into the tokens a search engine could read as words.
 *
 * Drops pure numbers, dimension suffixes such as 1024x768, version markers,
 * hash-like runs, tokens under three characters, and the workflow words in
 * NOISE_FILENAME_TOKENS.
 *
 * @param {string} value Text to tokenize.
 * @return {string[]} Tokens that carry meaning.
 */
const meaningfulTokens = (value) =>
	text(value)
		.toLowerCase()
		.split(/[-_.\s]+/)
		.filter((token) => {
			if (token.length < 3) {
				return false;
			}

			if (
				/^\d+$/.test(token) ||
				/^\d+x\d+$/.test(token) ||
				/^v\d+$/.test(token)
			) {
				return false;
			}

			if (/^[0-9a-f]{8,}$/.test(token)) {
				return false;
			}

			return !NOISE_FILENAME_TOKENS.has(token);
		});

const meaningfulFilenameTokens = (filename) =>
	meaningfulTokens(stripCounterSuffix(filenameStem(filename)));

/**
 * Reports whether two tokens look like the same word.
 *
 * Compares a leading slice rather than the whole token so that plurals and
 * related forms still match: boat/boats, door/doorway, porto/portugal.
 *
 * @param {string} first  First token.
 * @param {string} second Second token.
 * @return {boolean} True when the tokens share a stem.
 */
const tokensRelated = (first, second) => {
	if (
		first.length < TOKEN_PREFIX_LENGTH ||
		second.length < TOKEN_PREFIX_LENGTH
	) {
		return first === second;
	}

	return (
		first.slice(0, TOKEN_PREFIX_LENGTH) ===
		second.slice(0, TOKEN_PREFIX_LENGTH)
	);
};

const isGenericFilename = (filename) => {
	const stem = filenameStem(filename);

	if ('' === stem) {
		return false;
	}

	return GENERIC_FILENAME_PATTERNS.some((pattern) => pattern.test(stem));
};

const check = (id, code, status, extra = {}) => ({
	id,
	code,
	status,
	counts: CHECK_INFO !== status,
	tab: null,
	fieldId: null,
	detail: null,
	...extra,
});

const altCheck = (formData) => {
	const alt = text(formData.alt);
	const target = { tab: 'details', fieldId: 'fotogrids-item-alt' };

	if ('' === alt) {
		return check('alt', 'alt_missing', CHECK_FAIL, target);
	}

	if (alt.length > ALT_MAX_LENGTH) {
		return check('alt', 'alt_long', CHECK_WARN, {
			...target,
			detail: `${alt.length} / ${ALT_MAX_LENGTH}`,
		});
	}

	if (normalizeForCompare(alt) === normalizeForCompare(formData.title)) {
		return check('alt', 'alt_same_as_title', CHECK_WARN, target);
	}

	if (wordCount(alt) < ALT_MIN_WORDS) {
		return check('alt', 'alt_short', CHECK_WARN, target);
	}

	return check('alt', 'alt_ok', CHECK_PASS, target);
};

const filenameCheck = (formData, itemData) => {
	const filename = text(itemData.filename);
	const detail = { detail: filename };

	if ('' === filename) {
		return check('filename', 'filename_unknown', CHECK_INFO);
	}

	if (isGenericFilename(filename)) {
		return check('filename', 'filename_generic', CHECK_WARN, detail);
	}

	const tokens = meaningfulFilenameTokens(filename);

	if (0 === tokens.length) {
		return check('filename', 'filename_no_keywords', CHECK_WARN, detail);
	}

	if (tokens.length < FILENAME_MIN_WORDS) {
		return check('filename', 'filename_too_short', CHECK_WARN, detail);
	}

	const described = meaningfulTokens(
		[formData.title, formData.alt, formData.caption].join(' ')
	);

	if (
		described.length > 0 &&
		!tokens.some((token) =>
			described.some((word) => tokensRelated(token, word))
		)
	) {
		return check('filename', 'filename_unrelated', CHECK_WARN, detail);
	}

	return check('filename', 'filename_ok', CHECK_PASS);
};

const titleCheck = (formData, itemData) => {
	const title = text(formData.title);
	const target = { tab: 'details', fieldId: 'fotogrids-item-title' };

	if ('' === title) {
		return check('title', 'title_missing', CHECK_FAIL, target);
	}

	const stem = stripCounterSuffix(filenameStem(itemData.filename));

	if (
		'' !== stem &&
		normalizeForCompare(title) === normalizeForCompare(stem)
	) {
		return check('title', 'title_from_filename', CHECK_WARN, target);
	}

	return check('title', 'title_ok', CHECK_PASS, target);
};

const captionCheck = (formData) => {
	const target = { tab: 'details', fieldId: 'fotogrids-item-caption' };

	return '' === text(formData.caption)
		? check('caption', 'caption_missing', CHECK_WARN, target)
		: check('caption', 'caption_ok', CHECK_PASS, target);
};

const descriptionCheck = (formData) => {
	const target = { tab: 'details', fieldId: 'fotogrids-item-description' };

	return '' === text(formData.description)
		? check('description', 'description_missing', CHECK_WARN, target)
		: check('description', 'description_ok', CHECK_PASS, target);
};

const creditCheck = (formData) => {
	const target = { tab: 'details', fieldId: 'fotogrids-item-credit' };
	const credit = text(formData.credit);

	if ('' !== credit) {
		return check('credit', 'credit_ok', CHECK_PASS, {
			...target,
			detail: credit,
		});
	}

	const exifCopyright = text(formData.exif?.copyright);

	if ('' !== exifCopyright) {
		return check('credit', 'credit_from_exif', CHECK_PASS, {
			...target,
			detail: exifCopyright,
		});
	}

	return check('credit', 'credit_missing', CHECK_WARN, target);
};

const weightCheck = (itemData) => {
	const bytes = parseFileSize(itemData.filesize);
	const width = parseInt(itemData.width, 10) || 0;
	const height = parseInt(itemData.height, 10) || 0;
	const parts = [];

	if ('' !== text(itemData.filesize)) {
		parts.push(text(itemData.filesize));
	}

	if (width && height) {
		parts.push(`${width} × ${height}`);
	}

	const detail = parts.length ? parts.join(' · ') : null;

	if (null === bytes && !width) {
		return check('weight', 'weight_unknown', CHECK_INFO);
	}

	if (null !== bytes && bytes > HEAVY_FILE_BYTES) {
		return check('weight', 'weight_heavy', CHECK_WARN, { detail });
	}

	if (Math.max(width, height) > LARGE_EDGE_PIXELS) {
		return check('weight', 'weight_large', CHECK_WARN, { detail });
	}

	return check('weight', 'weight_ok', CHECK_PASS, { detail });
};

/**
 * Runs every per-item check against the current modal state.
 *
 * @param {Object} formData Current form values from the modal.
 * @param {Object} itemData Attachment data loaded for the item.
 * @return {Array<Object>} One result per check, in display order.
 */
export const getItemSeoChecks = (formData = {}, itemData = {}) => [
	altCheck(formData || {}),
	filenameCheck(formData || {}, itemData || {}),
	titleCheck(formData || {}, itemData || {}),
	captionCheck(formData || {}),
	descriptionCheck(formData || {}),
	creditCheck(formData || {}),
	weightCheck(itemData || {}),
];

export const BAND_BAD = 'bad';
export const BAND_NEEDS_IMPROVEMENT = 'needs_improvement';
export const BAND_GOOD = 'good';

const BAND_BAD_WARNINGS = 4;
const BAND_GOOD_WARNINGS = 1;

/**
 * Tallies the counting checks and places the item in an overall band.
 *
 * A failing check caps the band at bad on its own, and good tolerates a single
 * warning so that one item that cannot be changed after upload, such as the
 * filename, does not hold an otherwise complete image below the top band.
 *
 * @param {Array<Object>} checks Results from getItemSeoChecks().
 * @return {{ready: number, total: number, band: string}} Totals and band.
 */
export const summarizeSeoChecks = (checks = []) => {
	const counted = checks.filter((item) => item.counts);
	const ready = counted.filter((item) => CHECK_PASS === item.status).length;
	const failed = counted.filter((item) => CHECK_FAIL === item.status).length;
	const warned = counted.filter((item) => CHECK_WARN === item.status).length;

	let band = BAND_GOOD;

	if (failed > 0 || warned >= BAND_BAD_WARNINGS) {
		band = BAND_BAD;
	} else if (warned > BAND_GOOD_WARNINGS) {
		band = BAND_NEEDS_IMPROVEMENT;
	}

	return { ready, total: counted.length, band };
};

/**
 * Resolves the alt attribute the frontend renderer will emit for this item.
 *
 * Mirrors the fallback in Item_Renderer: the item alt, then the title.
 *
 * @param {Object} formData Current form values from the modal.
 * @return {{value: string, source: string}} Resolved value and its source.
 */
export const resolveEmittedAlt = (formData = {}) => {
	const alt = text(formData.alt);

	if ('' !== alt) {
		return { value: alt, source: 'alt' };
	}

	const title = text(formData.title);

	if ('' !== title) {
		return { value: title, source: 'title' };
	}

	return { value: '', source: 'empty' };
};
