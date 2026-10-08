/**
 * File Uploader Component
 * Handles file uploads, drag and drop, and media library selection
 */
import React from 'react';
import MediaUpload from '../blocks/MediaUpload';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;
const { createInterpolateElement } = wp.element;

const FileUploader = ({ onUploadComplete }) => {
	const handleUploadComplete = (attachmentIds) => {
		if (!attachmentIds || attachmentIds.length === 0 || !onUploadComplete) {
			return;
		}

		Promise.resolve(onUploadComplete(attachmentIds)).catch((error) => {
			console.error('Error creating gallery from upload:', error);
		});
	};

	const openMediaLibrary = () => {
		if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
			if (window.fotogridsToast) {
				window.fotogridsToast.error(
					__(
						'WordPress media library is not available. Please refresh the page.',
						'fotogrids'
					)
				);
			}
			return;
		}

		const mediaUploader = wp.media({
			title: __('Select Images for Gallery', 'fotogrids'),
			button: {
				text: __('Create Gallery', 'fotogrids'),
			},
			multiple: true,
			library: {
				type: 'image',
			},
		});

		mediaUploader.on('select', () => {
			const attachments = mediaUploader.state().get('selection').toJSON();
			const attachmentIds = attachments.map((att) => att.id);

			if (attachmentIds.length > 0 && onUploadComplete) {
				onUploadComplete(attachmentIds).catch((error) => {
					console.error(
						'Error creating gallery from library:',
						error
					);
					if (window.fotogridsToast) {
						window.fotogridsToast.error(
							error.message ||
								__('Failed to create gallery.', 'fotogrids')
						);
					}
				});
			}
		});

		mediaUploader.open();
	};

	return (
		<div className="fotogrids-admin-block-card fg-abc-uploader">
			<div className="fotogrids-admin-block-card-header">
				<Icon
					name="upload"
					className="fotogrids-admin-block-card-header-icon"
				/>
				<h3>{__('Quick Upload', 'fotogrids')}</h3>
				<p>
					{__(
						'Click or drag files here to create a gallery automatically.',
						'fotogrids'
					)}
				</p>
			</div>
			<div className="fotogrids-admin-block-card-content">
				<MediaUpload
					onUploadComplete={handleUploadComplete}
					inputId="fotogrids-dashboard-upload-input"
				/>
				<p className="fotogrids-upload-or">
					{createInterpolateElement(
						__(
							'or <link>choose existing files</link> from media library',
							'fotogrids'
						),
						{
							link: (
								<button
									type="button"
									onClick={openMediaLibrary}
									className="fotogrids-upload-or__link"
								/>
							),
						}
					)}
				</p>
			</div>
		</div>
	);
};

export default FileUploader;
