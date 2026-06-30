/**
 * Tests for render-settings/utils/tooltip-utils.js (window.FotoGridsTooltip.ProBadge)
 */
import '@/admin/plain/render-settings/utils/tooltip-utils';
import { renderElement, fireMouse } from '@tests/helpers/render-component';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ProBadge = (props) =>
	window.FotoGridsTooltip.ProBadge(props);

describe('tooltip-utils ProBadge', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders nothing for free / missing tier', () => {
		const a = renderElement(ProBadge({ tier: 'free' }));
		expect(a.container.querySelector('.fg-pro-badge')).toBeNull();

		const b = renderElement(ProBadge({ tier: undefined }));
		expect(b.container.querySelector('.fg-pro-badge')).toBeNull();
	});

	it('renders a badge with a lock icon for a pro tier', () => {
		const { container } = renderElement(ProBadge({ tier: 'pro_starter' }));
		const badge = container.querySelector('.fg-pro-badge');
		expect(badge).not.toBeNull();
		expect(badge.querySelector('svg.fg-pro-badge__lock-icon')).not.toBeNull();
	});

	it('uses the teaser copy by default', () => {
		const { container } = renderElement(ProBadge({ tier: 'pro_plus' }));
		expect(
			container.querySelector('.fg-pro-badge').getAttribute('aria-label')
		).toBe('Available from Pro Plus plan');
	});

	it('uses the locked copy when state is locked', () => {
		const { container } = renderElement(
			ProBadge({ tier: 'agency', state: 'locked' })
		);
		expect(
			container.querySelector('.fg-pro-badge').getAttribute('aria-label')
		).toBe('Renew your Agency plan to unlock this feature');
	});

	it('maps an unknown tier to the generic "Pro" label', () => {
		const { container } = renderElement(ProBadge({ tier: 'mystery' }));
		expect(
			container.querySelector('.fg-pro-badge').getAttribute('aria-label')
		).toBe('Available from Pro plan');
	});

	it('shows the tooltip bubble on mouse enter and hides on leave', () => {
		const { container } = renderElement(ProBadge({ tier: 'pro_starter' }));
		const trigger = container.querySelector('.fg-tooltip-trigger');

		fireMouse(trigger, 'mouseover');
		expect(
			document.querySelector('.fg-tooltip[role="tooltip"]')
		).not.toBeNull();

		fireMouse(trigger, 'mouseout');
		expect(
			document.querySelector('.fg-tooltip[role="tooltip"]')
		).toBeNull();
	});
});
