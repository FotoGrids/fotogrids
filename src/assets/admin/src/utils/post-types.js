/**
 * Gallery and album post types.
 */

export const GALLERY_POST_TYPE = 'fotogrids_gallery';
export const ALBUM_POST_TYPE = 'fotogrids_album';

/**
 * Post type for a collection kind.
 *
 * @param {string} kind 'gallery' | 'album'.
 * @returns {string} The album post type for 'album', otherwise the gallery post type.
 */
export const toPostType = (kind) =>
	'album' === kind ? ALBUM_POST_TYPE : GALLERY_POST_TYPE;
