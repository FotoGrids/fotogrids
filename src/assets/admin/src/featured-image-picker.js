/**
 * Featured / Share Image metabox picker.
 *
 * Vanilla wp.media wiring for the `fotogrids_featured_image_id` field on the
 * gallery and album edit screens. Reads and writes a hidden input; the value
 * is persisted server-side on save by Post_Types::save_featured_image().
 */

(function (wp) {
	function initPicker(root) {
		const input = root.querySelector('[data-fg-featured-image-input]');
		const preview = root.querySelector('[data-fg-featured-image-preview]');
		const setButton = root.querySelector('[data-fg-featured-image-set]');
		const removeButton = root.querySelector(
			'[data-fg-featured-image-remove]'
		);

		if (!input || !setButton) {
			return;
		}

		const strings = window.fotogridsFeaturedImage || {};
		let frame = null;

		const notifyChanged = () => {
			document.dispatchEvent(
				new CustomEvent('fotogrids:setting_changed')
			);
		};

		const showImage = (url) => {
			if (preview) {
				preview.innerHTML = '';
				const img = document.createElement('img');
				img.src = url;
				img.alt = '';
				preview.appendChild(img);
				preview.hidden = false;
			}
			if (removeButton) {
				removeButton.hidden = false;
			}
			setButton.textContent = strings.replace || 'Replace image';
		};

		const clearImage = () => {
			input.value = '';
			if (preview) {
				preview.innerHTML = '';
				preview.hidden = true;
			}
			if (removeButton) {
				removeButton.hidden = true;
			}
			setButton.textContent = strings.set || 'Set featured image';
			notifyChanged();
		};

		setButton.addEventListener('click', (event) => {
			event.preventDefault();

			if (!wp || !wp.media) {
				return;
			}

			if (frame) {
				frame.open();
				return;
			}

			frame = wp.media({
				title: strings.frameTitle || 'Featured / Share Image',
				button: { text: strings.frameButton || 'Use this image' },
				library: { type: 'image' },
				multiple: false,
			});

			frame.on('select', () => {
				const attachment = frame
					.state()
					.get('selection')
					.first()
					.toJSON();
				input.value = attachment.id;

				let url = attachment.url;
				if (attachment.sizes && attachment.sizes.medium) {
					url = attachment.sizes.medium.url;
				} else if (attachment.sizes && attachment.sizes.thumbnail) {
					url = attachment.sizes.thumbnail.url;
				}

				showImage(url);
				notifyChanged();
			});

			frame.open();
		});

		if (removeButton) {
			removeButton.addEventListener('click', (event) => {
				event.preventDefault();
				clearImage();
			});
		}
	}

	const boot = () => {
		document
			.querySelectorAll('[data-fg-featured-image]')
			.forEach((root) => initPicker(root));
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})(window.wp);
