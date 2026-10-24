/**
 * Tour definitions for the screens that have a walkthrough.
 *
 * A step points at `target`. When the target is not on the page, clicking
 * `reveal` (a tab) brings it in. Steps in the `place` part need a saved
 * collection; on a new one they open after the first save.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

const settingsLayoutStep = (body) => ({
	id: 'layout',
	target: '[data-fg-setting="layout"]',
	reveal: '[data-fg-settings-tab="layout"]',
	title: __('Choose a layout', 'fotogrids'),
	body,
});

const publishStep = (body) => ({
	id: 'publish',
	target: '#publish',
	title: __('Publish', 'fotogrids'),
	body,
	deferredBody: __(
		'Once it is saved, this tour comes back to show you how to put it on a page.',
		'fotogrids'
	),
});

/**
 * @returns {Object<string, Object>} Tours keyed by id.
 */
export const getTours = () => ({
	gallery: {
		ready: '.fotogrids-gallery-header',
		intro: (count) => ({
			title: __('Build your first gallery', 'fotogrids'),
			message: sprintf(
				/* translators: %d: number of steps in the tour. */
				_n(
					'%d short step takes a gallery from empty to live on your site.',
					'%d short steps take a gallery from empty to live on your site.',
					count,
					'fotogrids'
				),
				count
			),
		}),
		finish: {
			title: __('Your gallery is ready', 'fotogrids'),
			message: __(
				'Replay this tour any time with Tour in the Gallery Settings bar.',
				'fotogrids'
			),
		},
		steps: [
			{
				id: 'add-items',
				target: '[data-fg-walkthrough="gallery-add-items"]',
				reveal: '[data-fg-walkthrough="gallery-tab-manage"]',
				title: __('Add your images', 'fotogrids'),
				body: __(
					'Upload new images, pick them from the Media Library, or add a video. Drag items to change their order.',
					'fotogrids'
				),
			},
			settingsLayoutStep(
				__(
					'Pick how the items sit on the page: grid, masonry, justified and more. Every other setting can wait.',
					'fotogrids'
				)
			),
			{
				id: 'preview',
				target: '[data-fg-walkthrough="gallery-tab-preview"]',
				title: __('Check the preview', 'fotogrids'),
				body: __(
					'See the gallery the way visitors will, with your current settings, before it goes live.',
					'fotogrids'
				),
			},
			publishStep(
				__(
					'Publish puts the gallery live. Save Draft keeps it private while you work.',
					'fotogrids'
				)
			),
			{
				id: 'place',
				part: 'place',
				target: '#fotogrids_gallery_shortcode',
				title: __('Put it on a page', 'fotogrids'),
				body: __(
					'Copy this shortcode into any page or post. In the block editor you can also add the FotoGrids Gallery block and pick this gallery.',
					'fotogrids'
				),
			},
		],
	},
	album: {
		ready: '.fotogrids-album-galleries',
		intro: (count) => ({
			title: __('Build your first album', 'fotogrids'),
			message: sprintf(
				/* translators: %d: number of steps in the tour. */
				_n(
					'%d short step takes an album from empty to live on your site.',
					'%d short steps take an album from empty to live on your site.',
					count,
					'fotogrids'
				),
				count
			),
		}),
		finish: {
			title: __('Your album is ready', 'fotogrids'),
			message: __(
				'Replay this tour any time with Tour in the Album Settings bar.',
				'fotogrids'
			),
		},
		steps: [
			{
				id: 'add-galleries',
				target: '[data-fg-walkthrough="album-available-galleries"]',
				title: __('Add galleries', 'fotogrids'),
				body: __(
					'Pick the galleries this album holds. Drag them in the list above to set their order.',
					'fotogrids'
				),
			},
			settingsLayoutStep(
				__(
					'Pick how the gallery covers sit on the page. Every other setting can wait.',
					'fotogrids'
				)
			),
			publishStep(
				__(
					'Publish puts the album live. Save Draft keeps it private while you work.',
					'fotogrids'
				)
			),
			{
				id: 'place',
				part: 'place',
				target: '#fotogrids_album_shortcode',
				title: __('Put it on a page', 'fotogrids'),
				body: __(
					'Copy this shortcode into any page or post. In the block editor you can also add the FotoGrids Album block and pick this album.',
					'fotogrids'
				),
			},
		],
	},
	dashboard: {
		ready: '[data-fg-walkthrough="dashboard-start"]',
		intro: (count) => ({
			title: __('Welcome to FotoGrids', 'fotogrids'),
			message: sprintf(
				/* translators: %d: number of steps in the tour. */
				_n(
					'A quick look at the Dashboard, in %d step.',
					'A quick look at the Dashboard, in %d steps.',
					count,
					'fotogrids'
				),
				count
			),
		}),
		finish: {
			title: __('You are all set', 'fotogrids'),
			message: __(
				'Replay this tour any time with Take the tour in Learn & Get Inspired.',
				'fotogrids'
			),
		},
		steps: [
			{
				id: 'start',
				target: '[data-fg-walkthrough="dashboard-start"]',
				title: __('Start here', 'fotogrids'),
				body: __(
					'Create a gallery, then add your images in the gallery editor.',
					'fotogrids'
				),
			},
			{
				id: 'upload',
				target: '[data-fg-walkthrough="dashboard-upload"]',
				title: __('Or drop images straight in', 'fotogrids'),
				body: __(
					'Images you upload here become a new draft gallery.',
					'fotogrids'
				),
			},
			{
				id: 'create',
				target: '[data-fg-walkthrough="dashboard-create"]',
				title: __('More ways to start', 'fotogrids'),
				body: __(
					'Start an album, begin from a template, or adjust the defaults every new gallery starts with.',
					'fotogrids'
				),
			},
			{
				id: 'setup',
				target: '[data-fg-walkthrough="dashboard-setup"]',
				title: __('Track your setup', 'fotogrids'),
				body: __('Each step ticks itself off as you go.', 'fotogrids'),
			},
			{
				id: 'learn',
				target: '[data-fg-walkthrough="dashboard-learn"]',
				title: __('Help when you need it', 'fotogrids'),
				body: __(
					'Guides, integrations and the Help Center. You can replay this tour from here too.',
					'fotogrids'
				),
			},
		],
	},
});
