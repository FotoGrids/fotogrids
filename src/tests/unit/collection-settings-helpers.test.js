/**
 * Tests for the field-state helpers exported by collection-settings.js
 * (useFieldState, FieldGate, TeaserBadge, LockedBanner).
 *
 * collection-settings.js is a large module that mounts a React tree on
 * DOMContentLoaded; importing it for the exported helpers is fine because the
 * mount only runs when #fotogrids-collection-settings-root exists (it doesn't).
 */
import '@/admin/plain/render-settings/utils/post-type-placeholders';
import '@/admin/plain/collection-settings';
import { renderElement } from '@tests/helpers/render-component';

const __ = (t) => t;
const RS = () => window.FotoGridsRenderSettings;

describe('collection-settings field-state helpers', () => {
	describe('TeaserBadge / LockedBanner', () => {
		it('TeaserBadge renders a Pro badge', () => {
			const { container } = renderElement(
				wp.element.createElement(RS().TeaserBadge, { __ })
			);
			expect(
				container.querySelector('.fotogrids-pro-badge').textContent
			).toBe('Pro');
		});

		it('LockedBanner renders a locked notice', () => {
			const { container } = renderElement(
				wp.element.createElement(RS().LockedBanner, { __ })
			);
			expect(
				container.querySelector('.fotogrids-settings-locked-banner')
					.textContent
			).toMatch(/Locked/);
		});
	});

	describe('FieldGate (drives useFieldState / resolveFieldStateValue)', () => {
		const gate = (props) =>
			renderElement(
				wp.element.createElement(
					RS().FieldGate,
					{ __, ...props },
					wp.element.createElement('span', null, 'child')
				)
			);

		it('renders children plainly for an editable field', () => {
			const { container } = gate({
				setting: { key: 'k', type: 'toggle' },
				currentValue: '1',
				fieldStates: {},
				fieldStatesByOption: {},
			});
			expect(container.textContent).toContain('child');
			expect(
				container.querySelector('.fotogrids-field-gate--locked')
			).toBeNull();
			expect(
				container.querySelector('.fotogrids-field-gate--teaser')
			).toBeNull();
		});

		it('adds the teaser modifier when the field state is teaser', () => {
			const { container } = gate({
				setting: { key: 'k', type: 'toggle' },
				currentValue: '1',
				fieldStates: { k: 'teaser' },
				fieldStatesByOption: {},
			});
			expect(
				container.querySelector('.fotogrids-field-gate--teaser')
			).not.toBeNull();
		});

		it('adds the locked modifier and a banner when locked', () => {
			const { container } = gate({
				setting: { key: 'k', type: 'toggle' },
				currentValue: '1',
				fieldStates: { k: 'locked' },
				fieldStatesByOption: {},
			});
			expect(
				container.querySelector('.fotogrids-field-gate--locked')
			).not.toBeNull();
			expect(
				container.querySelector('.fotogrids-settings-locked-banner')
			).not.toBeNull();
		});

		it('prefers a per-option state over the field-level state', () => {
			const { container } = gate({
				setting: { key: 'layout', type: 'select' },
				currentValue: 'masonry',
				fieldStates: { layout: 'editable' },
				fieldStatesByOption: { 'layout.masonry': 'locked' },
			});
			expect(
				container.querySelector('.fotogrids-field-gate--locked')
			).not.toBeNull();
		});

		it('ignores per-option state for own-state field types (layout_grid)', () => {
			const { container } = gate({
				setting: { key: 'layout', type: 'layout_grid' },
				currentValue: 'masonry',
				fieldStates: { layout: 'editable' },
				fieldStatesByOption: { 'layout.masonry': 'locked' },
			});
			// own-state types ignore the per-option map -> stays editable
			expect(
				container.querySelector('.fotogrids-field-gate--locked')
			).toBeNull();
		});

		it('treats a setting without a key as editable', () => {
			const { container } = gate({
				setting: {},
				currentValue: '',
				fieldStates: { undefined: 'locked' },
				fieldStatesByOption: {},
			});
			expect(
				container.querySelector('.fotogrids-field-gate--locked')
			).toBeNull();
		});
	});
});
