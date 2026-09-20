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

			// The Library state restores whichever router tab was used last
			// (`libraryContent` user setting), so the tab has to be forced after
			// the state activates - which is what the 'open' event guarantees.
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

				// New items are never auto-featured. The server-side resolver
				// (`Cover_Resolver::for_gallery()`) falls back to
				// the first valid item when nothing is explicitly chosen, so
				// the UI accurately reflects "the user hasn't picked one yet".
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
