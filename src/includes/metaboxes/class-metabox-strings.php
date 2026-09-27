<?php
/**
 * Translatable strings shipped to the item-edit modal React tree.
 *
 * @package FotoGrids\Metaboxes
 * @since   1.1.4
 */

declare(strict_types=1);

namespace FotoGrids\Metaboxes;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Assembles the `strings` payload localised alongside the metabox bundle.
 *
 * One method per panel of the item-edit modal, so a panel's vocabulary can be
 * read and edited without scrolling past every other panel's.
 *
 * @since 1.1.4
 */
final class Metabox_Strings {

	/**
	 * The full string map, in the order the panels appear in the modal.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	public static function all(): array {
		return array_merge(
			self::modal_chrome_strings(),
			self::item_field_strings(),
			self::item_list_strings(),
			self::add_media_strings(),
			self::video_strings(),
			self::external_source_strings(),
			self::featured_item_strings(),
			self::item_meta_strings(),
			self::seo_checkup_strings(),
			self::metadata_strings(),
			self::media_tab_strings(),
			self::interaction_strings(),
		);
	}

	/**
	 * Modal chrome: open, save, error and unsaved-changes states.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function modal_chrome_strings(): array {
		return array(
			'selectItems'               => __( 'Select Items for Gallery', 'fotogrids' ),
			'addToGallery'              => __( 'Add to Gallery', 'fotogrids' ),
			'editItem'                  => __( 'Edit Item', 'fotogrids' ),
			'removeItem'                => __( 'Remove Item', 'fotogrids' ),
			'confirmClear'              => __( 'Are you sure you want to remove all items?', 'fotogrids' ),
			'mediaNotAvailable'         => __( 'WordPress media library is not available. Please refresh the page.', 'fotogrids' ),
			'loading'                   => __( 'Loading...', 'fotogrids' ),
			'errorLoadingItem'          => __( 'Error loading item data', 'fotogrids' ),
			'errorSaving'               => __( 'Error saving item data. Please try again', 'fotogrids' ),
			'itemSavedSuccessfully'     => __( 'Item saved successfully!', 'fotogrids' ),
			'unsavedChangesConfirm'     => __( "You have unsaved changes.\nAre you sure you want to close without saving?", 'fotogrids' ),
			'unsavedChangesNavigate'    => __( 'You have unsaved changes. Are you sure you want to navigate away without saving?', 'fotogrids' ),
			'unsavedChangesTitle'       => __( 'Discard changes?', 'fotogrids' ),
			'unsavedChangesDiscard'     => __( 'Discard changes', 'fotogrids' ),
			'unsavedChangesKeepEditing' => __( 'Keep editing', 'fotogrids' ),
		);
	}

	/**
	 * The editable item fields, modal navigation and metadata tab labels.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function item_field_strings(): array {
		return array(
			'title'       => __( 'Title', 'fotogrids' ),
			'altText'     => __( 'Alt Text', 'fotogrids' ),
			'caption'     => __( 'Caption', 'fotogrids' ),
			'description' => __( 'Description', 'fotogrids' ),
			'credit'      => __( 'Credit', 'fotogrids' ),
			'saveChanges' => __( 'Save Changes', 'fotogrids' ),
			'cancel'      => __( 'Cancel', 'fotogrids' ),
			'close'       => __( 'Close', 'fotogrids' ),
			'prevItem'    => __( 'Previous item', 'fotogrids' ),
			'nextItem'    => __( 'Next item', 'fotogrids' ),
			'dropHere'    => __( 'Drop here', 'fotogrids' ),
			'details'     => __( 'Details', 'fotogrids' ),
			'tags'        => __( 'Tags', 'fotogrids' ),
			'people'      => __( 'People', 'fotogrids' ),
			'location'    => __( 'Location', 'fotogrids' ),
		);
	}

	/**
	 * Item list toolbar and the remove-all confirmation.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function item_list_strings(): array {
		return array(
			'manageItems'                         => __( 'Manage Items', 'fotogrids' ),
			'previewGallery'                      => __( 'Preview Gallery', 'fotogrids' ),
			'addNew'                              => __( 'Add New', 'fotogrids' ),
			'removeAll'                           => __( 'Remove All', 'fotogrids' ),
			'removeAllItems'                      => __( 'Remove all items', 'fotogrids' ),
			'removeAllModalTitle'                 => __( 'Remove all gallery items?', 'fotogrids' ),
			'removeAllModalWarning'               => __( 'This action cannot be undone.', 'fotogrids' ),
			'removeAllModalBody'                  => __( 'You are about to remove every item from this gallery. The gallery will become empty, and the removed items will no longer appear here.', 'fotogrids' ),
			'removeAllModalDeleteCustomDataLabel' => __( 'Also delete custom data saved for these items', 'fotogrids' ),
			'removeAllModalDeleteCustomDataHelp'  => __( 'This includes item-specific FotoGrids data such as custom titles, descriptions, links, captions, alt text overrides, sorting data, tags, filters, and other custom fields. This data will be deleted for these items everywhere they are used in FotoGrids, including other galleries where the same items appear.', 'fotogrids' ),
			'removeAllModalConfirmPrompt'         => __( 'To confirm, type REMOVE ALL below.', 'fotogrids' ),
			'removeAllModalConfirmPlaceholder'    => __( 'Type REMOVE ALL', 'fotogrids' ),
			'bulkEditor'                          => __( 'Bulk Editor', 'fotogrids' ),
		);
	}

	/**
	 * The Add New sources: upload, media library, server folder and ZIP.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function add_media_strings(): array {
		return array(
			'upload'                       => __( 'Upload', 'fotogrids' ),
			'uploadDescription'            => __( 'Choose files from your computer', 'fotogrids' ),
			'fromLibrary'                  => __( 'From Library', 'fotogrids' ),
			'addFromLibrary'               => __( 'Add items from library', 'fotogrids' ),
			'fromLibraryDescription'       => __( 'Choose from WordPress media library', 'fotogrids' ),
			'uploadFromFolder'             => __( 'From Folder', 'fotogrids' ),
			'uploadFromFolderDescription'  => __( 'Browse uploads folder structure', 'fotogrids' ),
			'uploadFromZip'                => __( 'From ZIP', 'fotogrids' ),
			'uploadFromZipDescription'     => __( 'Upload and extract ZIP file', 'fotogrids' ),
			'uploadFromFolderModalTitle'   => __( 'Add images from a folder', 'fotogrids' ),
			'uploadFromFolderOnServer'     => __( 'On the server', 'fotogrids' ),
			'uploadFromFolderOnComputer'   => __( 'From my computer', 'fotogrids' ),
			'uploadFromFolderEmpty'        => __( 'No images in this folder.', 'fotogrids' ),
			'uploadFromFolderLoadFailed'   => __( 'That folder could not be read.', 'fotogrids' ),
			'uploadFromFolderNoImages'     => __( 'No images found in that folder.', 'fotogrids' ),
			'uploadFromFolderImportFailed' => __( 'The images could not be added.', 'fotogrids' ),
			'uploadFromFolderFilesSkipped' => __( 'files were skipped.', 'fotogrids' ),
			'uploadFromFolderNewBadge'     => __( 'New', 'fotogrids' ),
			'uploadFromFolderSelectAll'    => __( 'Select all', 'fotogrids' ),
			'uploadFromFolderLoadMore'     => __( 'Load more', 'fotogrids' ),
			'uploadFromFolderSelectTitle'  => __( 'Select a folder to upload', 'fotogrids' ),
			'uploadFromFolderDragDrop'     => __( 'or drag and drop images here', 'fotogrids' ),
			'uploadFromFolderHint'         => __( 'Every image in the folder and its sub-folders is uploaded to your Media Library.', 'fotogrids' ),
			'uploadFromFolderImagesReady'  => __( 'images ready to upload', 'fotogrids' ),
			'uploadFromFolderUploadAndAdd' => __( 'Upload & Add', 'fotogrids' ),
			'uploading'                    => __( 'Uploading…', 'fotogrids' ),
			'uploadFromZipModalTitle'      => __( 'Add images from a ZIP file', 'fotogrids' ),
			'uploadFromZipChoose'          => __( 'Select a ZIP file to upload', 'fotogrids' ),
			'uploadFromZipDragDrop'        => __( 'or drag and drop it here', 'fotogrids' ),
			'uploadFromZipInvalid'         => __( 'That file is not a ZIP archive.', 'fotogrids' ),
			'uploadFromZipFailed'          => __( 'The archive could not be imported.', 'fotogrids' ),
			'uploadFromZipExtracting'      => __( 'Extracting images…', 'fotogrids' ),
			'uploadFromZipUploadAndAdd'    => __( 'Upload & Add', 'fotogrids' ),
			'uploadFromZipImagesAdded'     => __( 'images added.', 'fotogrids' ),
			'uploadFromZipEntriesSkipped'  => __( 'entries were skipped:', 'fotogrids' ),
			'done'                         => __( 'Done', 'fotogrids' ),
			'uploadFromZipMaxSize'         => sprintf(
				/* translators: %s: formatted maximum upload size, e.g. 64 MB. */
				__( 'Maximum upload size: %s', 'fotogrids' ),
				size_format( wp_max_upload_size() )
			),
		);
	}

	/**
	 * Video items and the YouTube / Vimeo embed editor.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function video_strings(): array {
		return array(
			'video'                    => __( 'Video', 'fotogrids' ),
			'videoDescription'         => __( 'Add video files', 'fotogrids' ),
			'videoEmbed'               => __( 'Video Embed', 'fotogrids' ),
			'addVideoEmbed'            => __( 'Add a video embed', 'fotogrids' ),
			'addVideoEmbedDescription' => __( 'YouTube / Vimeo', 'fotogrids' ),
			'videoEmbedAdded'          => __( 'Video added to gallery.', 'fotogrids' ),
			'videoEmbedUpdated'        => __( 'Video updated.', 'fotogrids' ),
			'videoEmbedRemoveFailed'   => __( 'Failed to remove the video.', 'fotogrids' ),
			'editVideoEmbed'           => __( 'Edit Video Embed', 'fotogrids' ),
			'posterImage'              => __( 'Poster Image', 'fotogrids' ),
			'posterImageDesc'          => __( 'Shown in the gallery before the video plays. Defaults to the video’s own thumbnail.', 'fotogrids' ),
			'choosePoster'             => __( 'Choose Poster', 'fotogrids' ),
			'changePoster'             => __( 'Change Poster', 'fotogrids' ),
			'usePoster'                => __( 'Use as poster', 'fotogrids' ),
			'removePoster'             => __( 'Remove', 'fotogrids' ),
			'link'                     => __( 'Link', 'fotogrids' ),
			'loadVideo'                => __( 'Load video', 'fotogrids' ),
			'videoLoaded'              => __( 'Video loaded successfully.', 'fotogrids' ),
			'invalidYouTubeUrl'        => __( 'Please enter a valid YouTube URL.', 'fotogrids' ),
			'invalidVimeoUrl'          => __( 'Please enter a valid Vimeo URL.', 'fotogrids' ),
			'resolveError'             => __( 'Could not resolve video URL.', 'fotogrids' ),
			'resolveMetadataFailed'    => __( 'Video found but metadata could not be fetched.', 'fotogrids' ),
			'noThumbnail'              => __( 'No thumbnail available', 'fotogrids' ),
			'previewWillAppear'        => __( 'Preview will appear here', 'fotogrids' ),
			'startTime'                => __( 'Start Time', 'fotogrids' ),
			'startTimeDesc'            => __( 'Specify a start time (in seconds)', 'fotogrids' ),
			'endTime'                  => __( 'End Time', 'fotogrids' ),
			'endTimeDesc'              => __( 'Specify an end time (in seconds)', 'fotogrids' ),
			'videoOptions'             => __( 'Video Options', 'fotogrids' ),
			'autoplay'                 => __( 'Autoplay', 'fotogrids' ),
			'autoplayNote'             => __( 'Autoplay is subject to browser autoplay policies.', 'fotogrids' ),
			'mute'                     => __( 'Mute', 'fotogrids' ),
			'loop'                     => __( 'Loop', 'fotogrids' ),
			'playerControls'           => __( 'Player Controls', 'fotogrids' ),
			'captions'                 => __( 'Captions', 'fotogrids' ),
			'privacyMode'              => __( 'Privacy Mode', 'fotogrids' ),
			'privacyModeNote'          => __( "When on, the platform won't store information about visitors unless they play the video.", 'fotogrids' ),
			'suggestedVideos'          => __( 'Suggested Videos', 'fotogrids' ),
			'introTitle'               => __( 'Intro Title', 'fotogrids' ),
			'introPortrait'            => __( 'Intro Portrait', 'fotogrids' ),
			'introByline'              => __( 'Intro Byline', 'fotogrids' ),
			'controlsColor'            => __( 'Controls Color', 'fotogrids' ),
			'resetColor'               => __( 'Reset to default', 'fotogrids' ),
			'optional'                 => __( '(optional)', 'fotogrids' ),
			'adding'                   => __( 'Adding…', 'fotogrids' ),
		);
	}

	/**
	 * Third-party import sources offered in the Add New menu.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function external_source_strings(): array {
		return array(
			'fromOtherSources'            => __( 'Add from other sources', 'fotogrids' ),
			'fromOtherSourcesDescription' => __( 'Google Photos, Dropbox, Instagram, etc...', 'fotogrids' ),
			'instagram'                   => __( 'Instagram', 'fotogrids' ),
			'instagramDescription'        => __( 'Import from Instagram', 'fotogrids' ),
		);
	}

	/**
	 * Empty-grid states and the featured-item actions.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function featured_item_strings(): array {
		return array(
			'noItems'             => __( 'No items yet added.', 'fotogrids' ),
			'previewPlaceholder'  => __( 'Gallery preview functionality will be implemented here.', 'fotogrids' ),
			'previewEmptyTitle'   => __( 'Nothing to preview yet', 'fotogrids' ),
			'previewEmptyText'    => __( 'Add some items to this gallery and its preview will appear here.', 'fotogrids' ),
			'previewEmptyButton'  => __( 'Add items', 'fotogrids' ),
			'saving'              => __( 'Saving...', 'fotogrids' ),
			'interactions'        => __( 'Interactions', 'fotogrids' ),
			'setAsFeatured'       => __( 'Set as featured item', 'fotogrids' ),
			'clearFeatured'       => __( 'Clear featured item', 'fotogrids' ),
			'featuredItemSet'     => __( 'Featured item set', 'fotogrids' ),
			'featuredItemCleared' => __( 'Featured item cleared', 'fotogrids' ),
			'errorSavingFeatured' => __( 'Error saving featured item', 'fotogrids' ),
			'copied'              => __( 'Copied!', 'fotogrids' ),
			'copyFailed'          => __( 'Copy failed', 'fotogrids' ),
		);
	}

	/**
	 * Tab labels and the read-only file facts shown in the Details tab.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function item_meta_strings(): array {
		return array(
			'seo'           => __( 'SEO', 'fotogrids' ),
			'advanced'      => __( 'Advanced', 'fotogrids' ),
			'add'           => __( 'Add', 'fotogrids' ),
			'pro'           => __( 'Pro', 'fotogrids' ),
			'filename'      => __( 'Filename', 'fotogrids' ),
			'fileSize'      => __( 'File Size', 'fotogrids' ),
			'dimensions'    => __( 'Dimensions', 'fotogrids' ),
			'fileType'      => __( 'File Type', 'fotogrids' ),
			'notAvailable'  => __( 'Not Available', 'fotogrids' ),
			'failedLoading' => __( 'Failed to load item data', 'fotogrids' ),
			'upgradeToPro'  => __( 'Upgrade to Pro', 'fotogrids' ),
		);
	}

	/**
	 * The per-item SEO checkup: bands, check verdicts and emitted values.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function seo_checkup_strings(): array {
		return array(
			'seoCheckupTitle'            => __( 'Checks for this image', 'fotogrids' ),
			/* translators: 1: number of passing checks, 2: total number of checks. */
			'seoReadyCount'              => __( '%1$d of %2$d ready', 'fotogrids' ),
			'seoBandBad'                 => __( 'Bad', 'fotogrids' ),
			'seoBandNeedsImprovement'    => __( 'Needs improvement', 'fotogrids' ),
			'seoBandGood'                => __( 'Good', 'fotogrids' ),
			'seoCheckFix'                => __( 'Fix', 'fotogrids' ),
			'seoCheckWeightLabel'        => __( 'File weight', 'fotogrids' ),
			'seoCheckAltMissing'         => __( 'Empty. Screen readers and search engines have nothing to work from.', 'fotogrids' ),
			'seoCheckAltShort'           => __( 'Very short. A few descriptive words carry more than one.', 'fotogrids' ),
			'seoCheckAltLong'            => __( 'Over 125 characters. Screen readers cut long alt text off.', 'fotogrids' ),
			'seoCheckAltSameAsTitle'     => __( 'Same as the title. Describe what is in the frame instead.', 'fotogrids' ),
			'seoCheckAltOk'              => __( 'Describes the image and fits the usual length.', 'fotogrids' ),
			'seoCheckFilenameGeneric'    => __( 'A camera default. Rename files descriptively before uploading.', 'fotogrids' ),
			'seoCheckFilenameNoKeywords' => __( 'No descriptive words. The filename is part of the image URL, so rename before uploading.', 'fotogrids' ),
			'seoCheckFilenameTooShort'   => __( 'Only one descriptive word. Two or three that name the subject read better in the URL.', 'fotogrids' ),
			'seoCheckFilenameUnrelated'  => __( 'Nothing in common with the title, alt text or caption, so it probably does not describe this photo.', 'fotogrids' ),
			'seoCheckFilenameOk'         => __( 'Descriptive words in the image URL.', 'fotogrids' ),
			'seoCheckFilenameUnknown'    => __( 'No filename available for this item.', 'fotogrids' ),
			'seoCheckTitleMissing'       => __( 'Empty. The title is the fallback when there is no alt text.', 'fotogrids' ),
			'seoCheckTitleFromFilename'  => __( 'Still the filename WordPress filled in. Write a readable title.', 'fotogrids' ),
			'seoCheckTitleOk'            => __( 'Readable title set.', 'fotogrids' ),
			'seoCheckCaptionMissing'     => __( 'Empty. Captions show in the Lightbox and add context around the image.', 'fotogrids' ),
			'seoCheckCaptionOk'          => __( 'Caption set.', 'fotogrids' ),
			'seoCheckDescriptionMissing' => __( 'Empty. Room for the longer context a caption cannot hold.', 'fotogrids' ),
			'seoCheckDescriptionOk'      => __( 'Description set.', 'fotogrids' ),
			'seoCheckCreditMissing'      => __( 'Empty. A credit keeps attribution attached to the image.', 'fotogrids' ),
			'seoCheckCreditFromExif'     => __( 'Taken from the EXIF copyright field.', 'fotogrids' ),
			'seoCheckCreditOk'           => __( 'Credit set.', 'fotogrids' ),
			'seoCheckWeightHeavy'        => __( 'Heavy for a gallery image. Large files slow the page on mobile.', 'fotogrids' ),
			'seoCheckWeightLarge'        => __( 'Larger than most screens need. Resize before uploading.', 'fotogrids' ),
			'seoCheckWeightOk'           => __( 'Sensible size for the web.', 'fotogrids' ),
			'seoCheckWeightUnknown'      => __( 'File size not available for this item.', 'fotogrids' ),
			'seoEmitsTitle'              => __( 'What the gallery emits', 'fotogrids' ),
			'seoEmitsDescription'        => __( 'The values this image renders with on the frontend.', 'fotogrids' ),
			'seoEmitsAltFromAlt'         => __( 'From Alt Text', 'fotogrids' ),
			'seoEmitsAltFromTitle'       => __( 'From Title, because Alt Text is empty', 'fotogrids' ),
			'seoEmitsAltEmpty'           => __( 'Empty, because Alt Text and Title are both unset', 'fotogrids' ),
			'seoEmitsFilenameSource'     => __( 'In the image URL', 'fotogrids' ),
			'seoProNotice'               => __( 'Doing this by hand for every photo adds up. Pro writes alt text and titles for a whole gallery in one pass, then marks each image up with structured data and lists it in an XML sitemap so it can rank on its own.', 'fotogrids' ),
		);
	}

	/**
	 * Tags, people, location and EXIF metadata controls.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function metadata_strings(): array {
		return array(
			'locationSmartSuggestions'     => __( 'Smart location suggestions', 'fotogrids' ),
			'locationSmartSuggestionsDesc' => __( 'with map integration', 'fotogrids' ),
			'facialRecognition'            => __( 'AI Facial Recognition', 'fotogrids' ),
			'facialRecognitionDesc'        => __( '- automatically detect and tag people', 'fotogrids' ),
			'exif'                         => __( 'EXIF', 'fotogrids' ),
			'exifFields'                   => \FotoGrids\Exif\Exif_Fields::as_options(),
			'exifPerImageOverrides'        => __( 'Per-image EXIF overrides', 'fotogrids' ),
			'addTagsPlaceholder'           => __( 'Add tags...', 'fotogrids' ),
			'addPeoplePlaceholder'         => __( 'Add people...', 'fotogrids' ),
			'addLocationPlaceholder'       => __( 'Add location...', 'fotogrids' ),
		);
	}

	/**
	 * The Media tab: generated size inventory and per-size actions.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function media_tab_strings(): array {
		return array(
			'media'                   => __( 'Media', 'fotogrids' ),
			// translators: 1: number of generated image sizes, 2: total number of registered image sizes.
			'mediaSizesSummary'       => __( '%1$s of %2$s sizes available', 'fotogrids' ),
			'mediaSizesEmpty'         => __( 'Size variants are only generated for images.', 'fotogrids' ),
			'mediaSizeNotGenerated'   => __( 'Not generated', 'fotogrids' ),
			'mediaSizeFileMissing'    => __( 'File missing', 'fotogrids' ),
			'mediaSizeSourceTooSmall' => __( 'Source too small', 'fotogrids' ),
			'mediaSizeCropped'        => __( 'cropped', 'fotogrids' ),
			'mediaSourceFotoGrids'    => __( 'FotoGrids', 'fotogrids' ),
			'mediaSourceCore'         => __( 'WordPress', 'fotogrids' ),
			'mediaSourceTheme'        => __( 'Theme', 'fotogrids' ),
			'copyUrl'                 => __( 'Copy URL', 'fotogrids' ),
			'openInNewTab'            => __( 'Open in new tab', 'fotogrids' ),
			'regenerateThumbnails'    => __( 'Regenerate thumbnails', 'fotogrids' ),
			'urlCopied'               => __( 'Image URL copied', 'fotogrids' ),
		);
	}

	/**
	 * Per-item click behaviour and external-link controls.
	 *
	 * @since  1.1.4
	 * @return array<string, string|array<int, array<string, string>>>
	 */
	private static function interaction_strings(): array {
		return array(
			'itemInteractions'        => __( 'Item Interactions', 'fotogrids' ),
			'externalUrl'             => __( 'External URL', 'fotogrids' ),
			'externalUrlDesc'         => __( 'URL to redirect to when this item is clicked.', 'fotogrids' ),
			'linkTarget'              => __( 'Link Target', 'fotogrids' ),
			'linkTargetDesc'          => __( 'How the external link should open.', 'fotogrids' ),
			'linkTargetGlobal'        => __( 'Use Gallery Default', 'fotogrids' ),
			'linkTargetSelf'          => __( 'Same Tab', 'fotogrids' ),
			'linkTargetBlank'         => __( 'New Tab', 'fotogrids' ),
			'externalUrlIgnoredTitle' => __( 'External URLs are not in use', 'fotogrids' ),
			'externalUrlIgnoredBody'  => __( 'This gallery does not open items using their external URL, so the link below is saved but never followed. Set Item Click Behavior to External URL in the gallery settings to turn it on.', 'fotogrids' ),
		);
	}
}
