/**
 * Tests for render-settings/utils/post-type-placeholders.js
 */
import '@/admin/plain/render-settings/utils/post-type-placeholders';

const RS = () => window.FotoGridsRenderSettings;

describe('post-type-placeholders', () => {
	describe('getPostTypeValue', () => {
		it('returns gallery forms by default', () => {
			expect(RS().getPostTypeValue('gallery')).toBe('Gallery');
			expect(RS().getPostTypeValue('gallery', 'lower')).toBe('gallery');
			expect(RS().getPostTypeValue('gallery', 'plural')).toBe('Galleries');
			expect(RS().getPostTypeValue('gallery', 'plural.lower')).toBe(
				'galleries'
			);
		});

		it('returns album forms for album', () => {
			expect(RS().getPostTypeValue('album')).toBe('Album');
			expect(RS().getPostTypeValue('album', 'lower')).toBe('album');
			expect(RS().getPostTypeValue('album', 'plural')).toBe('Albums');
			expect(RS().getPostTypeValue('album', 'plural.lower')).toBe('albums');
		});

		it('falls back to the base form for an unknown property path', () => {
			expect(RS().getPostTypeValue('album', 'nope')).toBe('Album');
		});
	});

	describe('replacePostTypePlaceholders', () => {
		it('replaces all placeholder variants', () => {
			const out = RS().replacePostTypePlaceholders(
				'{postType} has {postType.plural.lower}, lower {postType.lower}, plural {postType.plural}',
				'gallery'
			);
			expect(out).toBe(
				'Gallery has galleries, lower gallery, plural Galleries'
			);
		});

		it('returns non-string input unchanged', () => {
			expect(RS().replacePostTypePlaceholders(null, 'gallery')).toBeNull();
			expect(RS().replacePostTypePlaceholders(42, 'gallery')).toBe(42);
			expect(RS().replacePostTypePlaceholders('', 'gallery')).toBe('');
		});
	});

	describe('processSettingPlaceholders', () => {
		it('returns non-object input unchanged', () => {
			expect(RS().processSettingPlaceholders(null, 'album')).toBeNull();
			expect(RS().processSettingPlaceholders('x', 'album')).toBe('x');
		});

		it('substitutes label, description, hint and hint_link', () => {
			const out = RS().processSettingPlaceholders(
				{
					label: '{postType} settings',
					description: 'For your {postType.lower}',
					hint: 'Edit the {postType}',
					hint_link: { label: 'Open {postType}', url: '/x' },
				},
				'album'
			);
			expect(out.label).toBe('Album settings');
			expect(out.description).toBe('For your album');
			expect(out.hint).toBe('Edit the Album');
			expect(out.hint_link.label).toBe('Open Album');
			expect(out.hint_link.url).toBe('/x');
		});

		it('substitutes info-block strings', () => {
			const out = RS().processSettingPlaceholders(
				{
					subtitle: 'Your {postType}',
					message: 'A {postType.lower} message',
					button_label: 'Make {postType}',
					button_url: '/{postType}',
				},
				'gallery'
			);
			expect(out.subtitle).toBe('Your Gallery');
			expect(out.message).toBe('A gallery message');
			expect(out.button_label).toBe('Make Gallery');
			// URLs are intentionally NOT substituted
			expect(out.button_url).toBe('/{postType}');
		});

		it('filters options by postTypes and substitutes their labels', () => {
			const out = RS().processSettingPlaceholders(
				{
					options: [
						{ value: 'a', label: '{postType} A' },
						{
							value: 'b',
							label: 'Album only',
							postTypes: ['album'],
						},
						{
							value: 'c',
							label: 'Gallery only',
							postTypes: ['gallery'],
							description: '{postType} desc',
						},
					],
				},
				'gallery'
			);
			const values = out.options.map((o) => o.value);
			expect(values).toEqual(['a', 'c']); // 'b' filtered out
			expect(out.options[0].label).toBe('Gallery A');
			expect(out.options[1].description).toBe('Gallery desc');
		});

		it('substitutes conditionalMessage and messages arrays', () => {
			const out = RS().processSettingPlaceholders(
				{
					conditionalMessage: { message: 'Need a {postType}' },
					messages: [
						{
							subtitle: '{postType} sub',
							message: '{postType.lower} msg',
						},
					],
				},
				'album'
			);
			expect(out.conditionalMessage.message).toBe('Need a Album');
			expect(out.messages[0].subtitle).toBe('Album sub');
			expect(out.messages[0].message).toBe('album msg');
		});

		it('recurses into nested settings', () => {
			const out = RS().processSettingPlaceholders(
				{
					label: 'Parent {postType}',
					settings: [{ label: 'Child {postType.plural}' }],
				},
				'album'
			);
			expect(out.label).toBe('Parent Album');
			expect(out.settings[0].label).toBe('Child Albums');
		});

		it('filters and substitutes subTabs', () => {
			const out = RS().processSettingPlaceholders(
				{
					subTabs: {
						general: { label: '{postType} general' },
						albumOnly: {
							label: 'Album tab',
							postTypes: ['album'],
						},
						galleryOnly: {
							label: 'Gallery tab',
							postTypes: ['gallery'],
							settings: [{ label: 'Inner {postType}' }],
						},
					},
				},
				'gallery'
			);
			expect(Object.keys(out.subTabs)).toEqual([
				'general',
				'galleryOnly',
			]);
			expect(out.subTabs.general.label).toBe('Gallery general');
			expect(out.subTabs.galleryOnly.settings[0].label).toBe(
				'Inner Gallery'
			);
		});
	});
});
