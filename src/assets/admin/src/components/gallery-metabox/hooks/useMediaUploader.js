/**
 * WordPress media frame access for the gallery metabox.
 */

import { useCallback } from 'react';

/**
 * Returns a function that opens the WordPress media frame and reports the
 * chosen attachments as grid items.
 *
 * @param {Object}   options
 * @param {Object}   options.strings  Localised strings.
 * @param {Function} options.onSelect Called with the selected attachments mapped to items.
 * @return {Function} Opens the frame; takes the router tab to land on.
 */
const useMediaUploader = ({ strings, onSelect }) =>
	useCallback(
		(contentMode = 'browse') => {
			if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
				if (window.fotogridsToast) {
					window.fotogridsToast.error(strings.mediaNotAvailable);
				}
				return;
			}

			const mediaUploader = wp.media({
				title: strings.selectItems,
				button: { text: strings.addToGallery },
				multiple: true,
				library: { type: 'image' },
			});

			// The Library state restores the last-used router tab, so the tab
			// has to be forced after it activates - hence 'open'.
			mediaUploader.on('open', () => {
				if (mediaUploader.content) {
					mediaUploader.content.mode(contentMode);
				}
			});

			mediaUploader.on('select', () => {
				const attachments = mediaUploader
					.state()
					.get('selection')
					.toJSON();

				onSelect(
					attachments.map((attachment) => ({
						id: attachment.id,
						title:
							attachment.title ||
							attachment.filename ||
							'Untitled',
						url: attachment.url,
						thumbnail:
							attachment.sizes?.thumbnail?.url || attachment.url,
						alt: attachment.alt || attachment.title || '',
						featured: false,
					}))
				);
			});

			mediaUploader.open();
		},
		[strings, onSelect]
	);

export default useMediaUploader;
