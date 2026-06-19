/**
 * Tests for src/assets/admin/src/deactivation/deactivation-feedback.js
 *
 * Auto-inits on import: attaches a capturing click listener that intercepts the
 * plugin's Deactivate link and opens a feedback modal.
 */

const BASENAME = 'fotogrids/fotogrids.php';

function loadModule() {
	jest.isolateModules(() => {
		require('@/admin/src/deactivation/deactivation-feedback');
	});
	document.dispatchEvent(new window.Event('DOMContentLoaded'));
}

function deactivateLink() {
	const a = document.createElement('a');
	a.id = 'deactivate-fotogrids';
	a.href = '/wp-admin/plugins.php?action=deactivate&plugin=' + BASENAME;
	a.textContent = 'Deactivate';
	document.body.appendChild(a);
	return a;
}

describe('deactivation-feedback', () => {
	let assignSpy;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.fotogridsDeactivation = {
			pluginBasename: BASENAME,
			action: 'fs_submit_uninstall_reason',
			security: 'sec',
			moduleId: '99',
			snoozePeriod: 86400,
			ajaxUrl: 'https://x/admin-ajax.php',
			debug: false,
			reasons: [{ id: 1, text: 'Too complex' }],
		};
		const loc = new URL(window.location.href);
		assignSpy = jest.fn();
		delete window.location;
		window.location = { href: loc.href, assign: assignSpy };
		global.fetch = jest.fn(() =>
			Promise.resolve({ ok: true, text: () => Promise.resolve('1') })
		);
	});

	afterEach(() => {
		delete window.fotogridsDeactivation;
		delete window.FotoGridsAdmin;
	});

	it('does nothing without settings', () => {
		delete window.fotogridsDeactivation;
		expect(() => loadModule()).not.toThrow();
	});

	it('navigates directly when no modal API is available', () => {
		loadModule();
		const link = deactivateLink();
		link.click();
		expect(assignSpy).toHaveBeenCalledWith(link.href);
	});

	it('opens the feedback modal when the modal API exists', () => {
		const open = jest.fn(() => ({ close: jest.fn() }));
		window.FotoGridsAdmin = { modal: { open } };
		loadModule();
		const link = deactivateLink();
		link.click();
		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'custom' })
		);
		// the click is intercepted, so navigation is deferred to the modal flow
		expect(assignSpy).not.toHaveBeenCalled();
	});

	it('ignores clicks that are not the deactivate link', () => {
		const open = jest.fn();
		window.FotoGridsAdmin = { modal: { open } };
		loadModule();
		const other = document.createElement('a');
		other.href = '/wp-admin/plugins.php?action=activate&plugin=other/o.php';
		document.body.appendChild(other);
		other.click();
		expect(open).not.toHaveBeenCalled();
		expect(assignSpy).not.toHaveBeenCalled();
	});

	it('matches a deactivate link by encoded href when id differs', () => {
		const open = jest.fn(() => ({ close: jest.fn() }));
		window.FotoGridsAdmin = { modal: { open } };
		loadModule();
		const a = document.createElement('a');
		a.href =
			'/wp-admin/plugins.php?action=deactivate&plugin=' +
			encodeURIComponent(BASENAME);
		document.body.appendChild(a);
		a.click();
		expect(open).toHaveBeenCalled();
	});

	// Open the modal, then pull the ReasonsForm element out of options.render()
	// to drive its wired onSubmit/onSkip/onCancel/onClose closures.
	const openAndGetFormProps = () => {
		const close = jest.fn();
		const open = jest.fn(() => ({ close }));
		window.FotoGridsAdmin = { modal: { open } };
		loadModule();
		const link = deactivateLink();
		link.click();
		const options = open.mock.calls[0][0];
		const element = options.render({ close });
		return { props: element.props, close, link };
	};

	it('onSubmit posts to Freemius then closes and navigates', async () => {
		const { props, close, link } = openAndGetFormProps();
		await props.onSubmit({ id: 3, details: 'too slow', snooze: false });
		expect(global.fetch).toHaveBeenCalledWith(
			'https://x/admin-ajax.php',
			expect.objectContaining({ method: 'POST' })
		);
		expect(close).toHaveBeenCalledWith('programmatic');
		expect(assignSpy).toHaveBeenCalledWith(link.href);
	});

	it('onSkip closes and navigates without posting', () => {
		const { props, close, link } = openAndGetFormProps();
		global.fetch.mockClear();
		props.onSkip();
		expect(global.fetch).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledWith('programmatic');
		expect(assignSpy).toHaveBeenCalledWith(link.href);
	});

	it('onCancel closes without navigating', () => {
		const { props, close } = openAndGetFormProps();
		props.onCancel();
		expect(close).toHaveBeenCalledWith('cancel');
		expect(assignSpy).not.toHaveBeenCalled();
	});

	it('onClose closes via the header close button', () => {
		const { props, close } = openAndGetFormProps();
		props.onClose();
		expect(close).toHaveBeenCalledWith('close-button');
	});

	it('submitToFreemius includes the snooze period when snoozing', async () => {
		const { props } = openAndGetFormProps();
		await props.onSubmit({ id: 1, details: '', snooze: true });
		const body = global.fetch.mock.calls[0][1].body;
		expect(body).toContain('snooze_period');
	});

	it('submitToFreemius swallows a network error and still navigates', async () => {
		window.fotogridsDeactivation.debug = true;
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.reject(new Error('down')));
		const { props, link } = openAndGetFormProps();
		await props.onSubmit({ id: 2, details: '', snooze: false });
		for (let i = 0; i < 6; i++) await Promise.resolve();
		// the failed post is swallowed; deactivation still proceeds
		expect(assignSpy).toHaveBeenCalledWith(link.href);
		warn.mockRestore();
	});
});
