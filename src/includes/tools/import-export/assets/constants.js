import { __ } from '@wordpress/i18n';

export const EXPORT_TYPES = [
	{
		key: 'galleries',
		label: __('Galleries', 'fotogrids'),
		description: __(
			'Gallery records and their display settings.',
			'fotogrids'
		),
		conflict: true,
	},
	{
		key: 'albums',
		label: __('Albums', 'fotogrids'),
		description: __('Albums and the galleries they contain.', 'fotogrids'),
		conflict: true,
	},
	{
		key: 'items',
		label: __('Items', 'fotogrids'),
		description: __(
			'Gallery items and their metadata (captions, alt text, order).',
			'fotogrids'
		),
	},
	{
		key: 'item_metadata',
		label: __('Item Metadata', 'fotogrids'),
		hidden: true, // imported automatically with items; not a separate user choice
	},
	{
		key: 'tags',
		label: __('Tags', 'fotogrids'),
		description: __(
			'Tags, people, and locations referenced by gallery items.',
			'fotogrids'
		),
	},
	{
		key: 'settings',
		label: __('Settings', 'fotogrids'),
		description: __(
			'Plugin settings. Choose which ones replace this site’s own.',
			'fotogrids'
		),
	},
	{
		key: 'statistics',
		label: __('Statistics', 'fotogrids'),
		description: __(
			'View and share counts. Useful when migrating between sites.',
			'fotogrids'
		),
	},
	{
		key: 'templates',
		label: __('Templates', 'fotogrids'),
		description: __(
			'Saved gallery templates included in the export file.',
			'fotogrids'
		),
	},
];

/**
 * The settings an import can apply, in the order the Import screen lists them.
 * Keys match Import_Export_Data::SETTINGS_KEYS.
 */
export const SETTINGS_TYPES = [
	{
		key: 'media',
		label: __('Media sizes', 'fotogrids'),
		description: __(
			'The image sizes on the Media settings tab.',
			'fotogrids'
		),
	},
	{
		key: 'collection_defaults',
		label: __('Gallery and album defaults', 'fotogrids'),
		description: __(
			'The settings new galleries and albums start with.',
			'fotogrids'
		),
	},
	{
		key: 'autosave',
		label: __('Autosave', 'fotogrids'),
		description: __('Whether changes save as you make them.', 'fotogrids'),
	},
	{
		key: 'preserve_data_on_uninstall',
		label: __('Delete all data on uninstall', 'fotogrids'),
		description: __(
			'Whether deleting FotoGrids also removes every gallery, album, template, statistic and setting.',
			'fotogrids'
		),
	},
	{
		key: 'share_statistics',
		label: __('Share usage data', 'fotogrids'),
		description: __(
			'Opts this site in to or out of sharing usage data, as the Advanced tab does.',
			'fotogrids'
		),
	},
];

export const CONFLICT_OPTIONS = [
	{ value: 'skip', label: __('Skip existing', 'fotogrids') },
	{ value: 'overwrite', label: __('Overwrite', 'fotogrids') },
	{ value: 'duplicate', label: __('Duplicate', 'fotogrids') },
];

export const TABS = [
	{ id: 'export', label: __('Export', 'fotogrids'), icon: 'export' },
	{ id: 'import', label: __('Import', 'fotogrids'), icon: 'import' },
	{ id: 'history', label: __('History', 'fotogrids'), icon: 'list' },
];

/**
 * Presentation metadata for the operation type recorded in the log.
 */
export const LOG_TYPE_META = {
	export: { icon: 'download', label: __('Export', 'fotogrids') },
	import: { icon: 'upload', label: __('Import', 'fotogrids') },
};

/**
 * Presentation metadata for the status recorded in the log.
 */
export const LOG_STATUS_META = {
	complete: { icon: 'check_circle', label: __('Complete', 'fotogrids') },
	partial: { icon: 'alert_circle', label: __('Partial', 'fotogrids') },
	failed: { icon: 'x_circle', label: __('Failed', 'fotogrids') },
	error: { icon: 'x_circle', label: __('Failed', 'fotogrids') },
	success: { icon: 'check_circle', label: __('Complete', 'fotogrids') },
};

/**
 * Singular / plural labels for the data types counted in a log summary.
 * Keys match the raw English keys written server-side.
 */
export const LOG_DETAIL_LABELS = {
	galleries: [__('Gallery', 'fotogrids'), __('Galleries', 'fotogrids')],
	albums: [__('Album', 'fotogrids'), __('Albums', 'fotogrids')],
	items: [__('Item', 'fotogrids'), __('Items', 'fotogrids')],
	tags: [__('Tag', 'fotogrids'), __('Tags', 'fotogrids')],
	templates: [__('Template', 'fotogrids'), __('Templates', 'fotogrids')],
	settings: [__('Settings', 'fotogrids'), __('Settings', 'fotogrids')],
};
