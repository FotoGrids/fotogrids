/**
 * Display title for galleries and albums, with a placeholder for empty titles.
 *
 * Mirrors \FotoGrids\Collection_Title on the PHP side.
 *
 * @since 1.1.4
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Whether a stored gallery or album title is empty.
 *
 * @param {string|null|undefined} title Stored title.
 * @returns {boolean} True when the title is empty or whitespace.
 */
export const isUntitled = (title) => !title || !String(title).trim();

/**
 * Placeholder label for a gallery or album, e.g. "Gallery #123".
 *
 * @param {string} kind 'gallery' | 'album' (or the post type).
 * @param {number} id   Post ID.
 * @returns {string} Placeholder label.
 */
export const collectionPlaceholder = (kind, id) => {
	if ('album' === kind || 'fotogrids_album' === kind) {
		/* translators: %d: album ID. */
		return sprintf(__('Album #%d', 'fotogrids'), id);
	}

	/* translators: %d: gallery ID. */
	return sprintf(__('Gallery #%d', 'fotogrids'), id);
};

/**
 * The stored title, or the placeholder when the title is empty.
 *
 * @param {string|null|undefined} title Stored title.
 * @param {string}                kind  'gallery' | 'album' (or the post type).
 * @param {number}                id    Post ID.
 * @returns {string} Title to display.
 */
export const collectionTitle = (title, kind, id) =>
	isUntitled(title) ? collectionPlaceholder(kind, id) : title;
