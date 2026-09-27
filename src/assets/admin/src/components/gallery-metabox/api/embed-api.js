/**
 * REST operations for video embed items.
 *
 * Embeds are virtual item_meta rows rather than attachments, so they are
 * created, updated and deleted through their own endpoints instead of the
 * gallery's item list.
 */

import { buildRestUrl } from '../../../utils/rest-url';

/**
 * Maps the modal's UI-facing source to the canonical item_type identifier the
 * embed endpoints expect.
 *
 * @param {string} source 'youtube' or 'vimeo'.
 * @return {string} 'video_youtube' or 'video_vimeo'.
 */
export const toCanonicalSource = (source) =>
	source === 'vimeo' ? 'video_vimeo' : 'video_youtube';

const EMBED_ROUTE = 'fotogrids/v1/items/embed';

const restNonce = () => window.wpApiSettings?.nonce || '';

/**
 * Surfaces a failed response as a toast and throws it.
 *
 * @param {Response} response Fetch response with a non-OK status.
 * @return {Promise<never>}
 * @throws {Error} Always.
 */
const throwResponseError = async (response) => {
	const err = await response.json().catch(() => ({}));
	const msg = err.message || `HTTP ${response.status}`;
	if (window.fotogridsToast) {
		window.fotogridsToast.error(msg);
	}
	throw new Error(msg);
};

/**
 * Creates a virtual embed item on the gallery.
 *
 * @param {Object} options
 * @param {Object} options.embedForm Form payload from VideoEmbedModal.
 * @param {number|string} options.galleryId Gallery the embed belongs to.
 * @return {Promise<Object>} The created embed row.
 * @throws {Error} When the request fails.
 */
export const createEmbed = async ({ embedForm, galleryId }) => {
	const nonce = restNonce();

	const response = await fetch(buildRestUrl(EMBED_ROUTE), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': nonce,
		},
		body: JSON.stringify({
			gallery_id: galleryId,
			...embedForm,
			source: toCanonicalSource(embedForm.source),
		}),
	});

	if (!response.ok) {
		await throwResponseError(response);
	}

	return response.json();
};

/**
 * Updates an existing embed item.
 *
 * @param {Object} options
 * @param {Object} options.embedForm Form payload from VideoEmbedModal, carrying the embed id.
 * @return {Promise<Object>} The updated embed row.
 * @throws {Error} When the request fails.
 */
export const updateEmbed = async ({ embedForm }) => {
	const nonce = restNonce();

	const response = await fetch(
		buildRestUrl(`${EMBED_ROUTE}/${embedForm.id}`),
		{
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			body: JSON.stringify({
				...embedForm,
				source: toCanonicalSource(embedForm.source),
			}),
		}
	);

	if (!response.ok) {
		await throwResponseError(response);
	}

	return response.json();
};

/**
 * Deletes an embed item. Failures are reported to the user but not thrown, so
 * removing the tile from the grid is never blocked by the request.
 *
 * @param {Object} options
 * @param {number|string} options.embedId Embed item id.
 * @param {Object} options.strings Localised strings.
 * @return {Promise<void>}
 */
export const deleteEmbed = async ({ embedId, strings }) => {
	const nonce = restNonce();

	try {
		const response = await fetch(
			buildRestUrl(`${EMBED_ROUTE}/${embedId}`),
			{
				method: 'DELETE',
				headers: { 'X-WP-Nonce': nonce },
			}
		);
		if (!response.ok) {
			const err = await response.json().catch(() => ({}));
			throw new Error(err.message || `HTTP ${response.status}`);
		}
	} catch (err) {
		console.error('[FotoGrids] Failed to delete video embed', err);
		if (window.fotogridsToast) {
			window.fotogridsToast.error(
				strings.videoEmbedRemoveFailed || 'Failed to remove the video.'
			);
		}
	}
};
