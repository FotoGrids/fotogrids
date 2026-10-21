/**
 * Tests for render-settings/utils/settings-mode.js
 */
import '@/admin/plain/render-settings/utils/settings-mode';

const SM = () => window.FotoGridsSettingsMode;

const EASY = ['easy', 'advanced'];

const TREE = {
	layout: {
		id: 'layout',
		label: 'Layout',
		settings: [
			{ key: 'layout', type: 'layout_grid', modes: EASY },
			{
				key: 'item_spacing',
				type: 'responsive_range',
				condition: { dependsOn: 'layout', values: ['grid'] },
			},
			{
				id: 'easy_spacing',
				type: 'preset_group',
				modes: ['easy'],
				condition: { dependsOn: 'layout', values: ['grid'] },
				options: [
					{ value: 'none', values: { item_spacing: 0 } },
					{ value: 'small', values: { item_spacing: 10 } },
				],
			},
			{
				key: 'group_a',
				type: 'setting_group',
				settings: [
					{ key: 'columns', type: 'range', modes: EASY },
					{ key: 'gap_unit', type: 'select' },
				],
			},
			{
				key: 'group_b',
				type: 'setting_group',
				settings: [{ key: 'advanced_only', type: 'toggle' }],
			},
			{
				type: 'side_by_side',
				settings: [
					{ key: 'sbs_easy', type: 'toggle', modes: ['easy'] },
					{ key: 'sbs_adv', type: 'toggle' },
				],
			},
			{
				key: 'tabs_in_settings',
				type: 'setting_subtabs',
				subTabs: {
					one: {
						id: 'one',
						settings: [{ key: 'st_easy', type: 'toggle', modes: EASY }],
					},
					two: {
						id: 'two',
						settings: [{ key: 'st_adv', type: 'toggle' }],
					},
				},
			},
			{
				key: 'subtabs_adv',
				type: 'setting_subtabs',
				subTabs: {
					one: { id: 'one', settings: [{ key: 'x', type: 'toggle' }] },
				},
			},
			{ key: 'note', type: 'info_block' },
		],
	},
	lightbox: {
		id: 'lightbox',
		subTabs: {
			general: {
				id: 'general',
				settings: [{ key: 'lightbox_loop', type: 'toggle', modes: EASY }],
			},
			styling: {
				id: 'styling',
				settings: [{ key: 'lightbox_bg', type: 'color' }],
			},
			wrapperOptOut: {
				id: 'wrapperOptOut',
				modes: ['advanced'],
				settings: [{ key: 'wrapped', type: 'toggle', modes: EASY }],
			},
		},
	},
	seo: {
		id: 'seo',
		settings: [{ key: 'seo_title', type: 'text_input' }],
	},
};

describe('settings-mode helpers', () => {
	describe('nodeModes / isContainer', () => {
		it('treats an absent or empty modes list as Advanced only', () => {
			expect(SM().nodeModes({ key: 'a' })).toEqual(['advanced']);
			expect(SM().nodeModes({ key: 'a', modes: [] })).toEqual(['advanced']);
			expect(SM().nodeModes({ modes: ['easy'] })).toEqual(['easy']);
		});

		it('recognises the container types', () => {
			expect(SM().isContainer({ type: 'setting_group' })).toBe(true);
			expect(SM().isContainer({ type: 'side_by_side' })).toBe(true);
			expect(SM().isContainer({ type: 'setting_subtabs' })).toBe(true);
			expect(SM().isContainer({ type: 'toggle' })).toBe(false);
			expect(SM().isContainer(null)).toBe(false);
		});
	});

	describe('filterTreeForMode', () => {
		it('keeps only Easy leaves and the containers holding them', () => {
			const easy = SM().filterTreeForMode(TREE, 'easy');
			const layout = easy.layout.settings;
			const ids = layout.map((s) => s.key || s.id || s.type);

			expect(ids).toEqual([
				'layout',
				'easy_spacing',
				'group_a',
				'side_by_side',
				'tabs_in_settings',
			]);
			expect(layout[2].settings.map((s) => s.key)).toEqual(['columns']);
			expect(layout[3].settings.map((s) => s.key)).toEqual(['sbs_easy']);
			expect(Object.keys(layout[4].subTabs)).toEqual(['one']);
		});

		it('leaves conditions untouched', () => {
			const easy = SM().filterTreeForMode(TREE, 'easy');
			expect(easy.layout.settings[1].condition).toEqual({
				dependsOn: 'layout',
				values: ['grid'],
			});
		});

		it('drops emptied subtabs and tabs, honouring an opted-out wrapper', () => {
			const easy = SM().filterTreeForMode(TREE, 'easy');
			expect(Object.keys(easy)).toEqual(['layout', 'lightbox']);
			expect(Object.keys(easy.lightbox.subTabs)).toEqual(['general']);
		});

		it('shows every untagged node in Advanced and hides Easy-only presets', () => {
			const adv = SM().filterTreeForMode(TREE, 'advanced');
			const ids = adv.layout.settings.map((s) => s.key || s.id || s.type);
			expect(ids).not.toContain('easy_spacing');
			expect(ids).toContain('item_spacing');
			expect(ids).toContain('note');
			expect(adv.layout.settings.find((s) => s.type === 'side_by_side')
				.settings.map((s) => s.key)).toEqual(['sbs_adv']);
			expect(Object.keys(adv)).toEqual(['layout', 'lightbox', 'seo']);
		});

		it('does not mutate the source tree', () => {
			const before = JSON.stringify(TREE);
			SM().filterTreeForMode(TREE, 'easy');
			expect(JSON.stringify(TREE)).toBe(before);
		});

		it('handles malformed input', () => {
			expect(SM().filterTreeForMode(null, 'easy')).toEqual({});
			expect(
				SM().filterTreeForMode(
					{
						bad: null,
						optOut: { modes: ['advanced'], settings: [{ modes: EASY }] },
						group: {
							settings: [
								null,
								{ type: 'setting_group' },
								{ type: 'setting_subtabs' },
								{ type: 'setting_subtabs', subTabs: { a: null } },
							],
						},
					},
					'easy'
				)
			).toEqual({});
		});
	});

	describe('walkLeaves / presetKeys / collectModeKeys', () => {
		it('visits every leaf once', () => {
			const keys = [];
			SM().walkLeaves(TREE, (n) => keys.push(n.key || n.id));
			expect(keys).toContain('st_adv');
			expect(keys).toContain('lightbox_bg');
			expect(keys).toContain('easy_spacing');
			expect(keys).not.toContain('group_a');
			SM().walkLeaves(null, () => {
				throw new Error('should not visit');
			});
		});

		it('collects preset keys without duplicates', () => {
			expect(
				SM().presetKeys({
					options: [
						{ values: { a: 1, b: 2 } },
						{ values: { b: 3, c: 4 } },
						{ label: 'no values' },
						null,
					],
				})
			).toEqual(['a', 'b', 'c']);
			expect(SM().presetKeys({})).toEqual([]);
		});

		it('counts keys written by visible presets as Easy keys', () => {
			const keys = SM().collectModeKeys(TREE, 'easy');
			expect(keys.has('item_spacing')).toBe(true);
			expect(keys.has('columns')).toBe(true);
			expect(keys.has('gap_unit')).toBe(false);
		});
	});

	describe('resolveActiveTab', () => {
		const visible = { layout: {}, lightbox: {} };

		it('keeps a still-visible tab', () => {
			expect(SM().resolveActiveTab(visible, 'lightbox')).toBe('lightbox');
		});

		it('falls back to the first shown tab when the active one emptied', () => {
			expect(SM().resolveActiveTab(visible, 'seo')).toBe('layout');
			expect(
				SM().resolveActiveTab(visible, 'seo', (g) => g !== visible.layout)
			).toBe('lightbox');
		});

		it('falls back to the first tab when none passes, or keeps the id when empty', () => {
			expect(SM().resolveActiveTab(visible, 'seo', () => false)).toBe(
				'layout'
			);
			expect(SM().resolveActiveTab({}, 'seo')).toBe('seo');
			expect(SM().resolveActiveTab(null, 'seo')).toBe('seo');
		});
	});

	describe('looseEqual', () => {
		it.each([
			[5, '5', true],
			['5.0', 5, true],
			[true, '1', true],
			[false, '0', true],
			[false, '', true],
			[false, undefined, true],
			[true, 'yes', false],
			[null, undefined, true],
			['grid', 'grid', true],
			['grid', 'masonry', false],
			[0, '', false],
			[[1, 2], ['1', '2'], true],
			[[1, 2], [1], false],
			[[1], 1, false],
			['[1,2]', [1, 2], true],
			['{"a":1}', { a: '1' }, true],
			['{bad', '{bad', true],
			[{ a: 1, _linked: true }, { a: 1 }, true],
			[{ a: 1 }, { a: 1, b: 2 }, false],
			[{ value: 6, unit: 'px' }, 6, true],
			[6, { top: 6, right: '6', bottom: 6, left: 6 }, true],
			[{ top: 6, right: 4 }, 6, false],
			[{}, 6, false],
		])('looseEqual(%p, %p) is %p', (a, b, expected) => {
			expect(SM().looseEqual(a, b)).toBe(expected);
		});
	});

	describe('matchPreset', () => {
		const SPACING = [
			{
				value: 'none',
				values: { item_spacing: { desktop: 0, tablet: 0, mobile: 0 } },
			},
			{
				value: 'small',
				values: { item_spacing: { desktop: 10, tablet: 8, mobile: 5 } },
			},
			{ value: 'desk', values: { item_spacing: { desktop: 20 } } },
		];

		it('matches numeric strings against numbers', () => {
			expect(
				SM().matchPreset(SPACING, {
					item_spacing: { desktop: '10', tablet: '8', mobile: 5 },
				}).value
			).toBe('small');
		});

		it('compares only the breakpoints a partial option lists', () => {
			expect(
				SM().matchPreset(SPACING, {
					item_spacing: { desktop: 20, tablet: 3, mobile: 1 },
				}).value
			).toBe('desk');
		});

		it('parses a JSON-encoded stored value', () => {
			expect(
				SM().matchPreset(SPACING, {
					item_spacing: '{"desktop":0,"tablet":0,"mobile":0}',
				}).value
			).toBe('none');
		});

		it('matches four-sided values against a scalar per breakpoint', () => {
			const corners = [
				{
					value: 'soft',
					values: { border_radius: { desktop: 6, tablet: 6, mobile: 6 } },
				},
			];
			const sides = { top: 6, right: 6, bottom: 6, left: 6 };
			expect(
				SM().matchPreset(corners, {
					border_radius: { desktop: sides, tablet: sides, mobile: sides },
				}).value
			).toBe('soft');
		});

		it('matches a single-key None option and the first of several matches', () => {
			const shadow = [
				{ value: 'none', values: { shadow_enabled: false } },
				{
					value: 'soft',
					values: { shadow_enabled: true, shadow_blur: 10 },
				},
				{
					value: 'soft-dup',
					values: { shadow_enabled: true, shadow_blur: 10 },
				},
			];
			expect(
				SM().matchPreset(shadow, { shadow_enabled: '0', shadow_blur: 99 })
					.value
			).toBe('none');
			expect(
				SM().matchPreset(shadow, { shadow_enabled: '1', shadow_blur: '10' })
					.value
			).toBe('soft');
		});

		it('returns null (Custom) when nothing matches', () => {
			expect(
				SM().matchPreset(SPACING, { item_spacing: { desktop: 3 } })
			).toBeNull();
			expect(SM().matchPreset(SPACING, {})).toBeNull();
			expect(SM().matchPreset(null, null)).toBeNull();
			expect(
				SM().matchPreset([{ value: 'empty', values: {} }, null], {})
			).toBeNull();
		});
	});

	describe('applyPresetValues', () => {
		it('merges a partial object over the current object and drops UI keys', () => {
			const out = SM().applyPresetValues(
				{ item_spacing: { desktop: 20 }, layout: 'grid' },
				{
					item_spacing: '{"desktop":1,"tablet":2,"mobile":3,"_linked":true}',
				}
			);
			expect(out).toEqual({
				item_spacing: { desktop: 20, tablet: 2, mobile: 3 },
				layout: 'grid',
			});
		});

		it('clones values so the catalog option is never shared', () => {
			const values = { radius: { desktop: 4 } };
			const out = SM().applyPresetValues(values, null);
			expect(out.radius).toEqual({ desktop: 4 });
			expect(out.radius).not.toBe(values.radius);
			expect(SM().applyPresetValues(null, {})).toEqual({});
			expect(SM().applyPresetValues({ u: undefined }, {})).toEqual({
				u: undefined,
			});
		});
	});

});
