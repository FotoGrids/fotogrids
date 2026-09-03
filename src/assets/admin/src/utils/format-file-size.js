/**
 * Human-readable file sizes for the admin UI.
 */

const UNITS = ['B', 'KB', 'MB', 'GB'];

/**
 * Format a byte count as a short file size, e.g. "1.4 MB".
 *
 * @param {number} bytes
 * @returns {string} Empty string when the size is unknown or zero.
 */
export function formatFileSize(bytes) {
	if (!bytes) {
		return '';
	}

	let value = bytes;
	let unit = 0;

	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}

	const rounded =
		value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value);

	return `${rounded} ${UNITS[unit]}`;
}
