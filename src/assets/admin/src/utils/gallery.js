/**
 * Gallery Helper Utilities
 */
import { addItemsToGallery } from './api';

/**
 * Create a gallery from image IDs
 */
export const createGalleryFromImages = async imageIds => {
	if (!imageIds || imageIds.length === 0) return null;

	try {
		const { __ } = wp.i18n;
		const galleryTitle =
			__('Gallery', 'fotogrids') + ' ' + new Date().toLocaleDateString();

		const galleryResponse = await wp.apiFetch({
			path: '/wp/v2/fotogrids-galleries',
			method: 'POST',
			data: {
				title: galleryTitle,
				status: 'draft',
			},
		});

		if (galleryResponse && galleryResponse.id) {
			await addItemsToGallery(galleryResponse.id, imageIds);

			window.location.href = `post.php?post=${galleryResponse.id}&action=edit`;

			return galleryResponse;
		}

		throw new Error('Failed to create gallery');
	} catch (error) {
		console.error('Error creating gallery:', error);
		const { __ } = wp.i18n;
		throw new Error(
			__(
				'Images uploaded but failed to create gallery. You can manually create a gallery.',
				'fotogrids',
			),
		);
	}
};
