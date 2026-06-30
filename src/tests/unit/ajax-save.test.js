/**
 * Tests for src/assets/admin/src/ajax-save.js
 *
 * IIFE that wires up on DOMContentLoaded for gallery/album edit screens and
 * exposes window.FotoGridsAjaxSave. We build the expected DOM, load the module
 * in isolation, then dispatch DOMContentLoaded to run init.
 */

function buildEditScreenDom() {
	document.body.className = 'post-type-fotogrids_gallery';
	document.body.innerHTML = `
		<div id="wpadminbar"><ul id="wp-admin-bar-root-default"></ul></div>
		<div class="wrap"><h1>Edit</h1></div>
		<form id="post">
			<input type="text" name="post_title" value="My Gallery" />
			<input type="hidden" id="post_ID" value="42" />
			<input type="hidden" name="post_type" value="fotogrids_gallery" />
			<input type="hidden" id="fotogrids_meta_box_nonce" value="nonce123" />
			<input type="hidden" name="fotogrids_columns" value="3" />
			<input type="hidden" id="original_post_status" value="publish" />
			<input type="submit" id="save-post" value="Update" />
			<input type="submit" id="publish" value="Publish" />
			<div id="submitdiv"><div class="inside"></div></div>
			<div id="major-publishing-actions">
				<div id="publishing-action"></div>
			</div>
		</form>
		<div id="fotogrids-items-grid">
			<div class="fotogrids-item-item" data-id="10"></div>
			<div class="fotogrids-item-item" data-id="11"></div>
		</div>
	`;
}

function loadAndInit() {
	jest.isolateModules(() => {
		require('@/admin/src/collection-state-manager');
		require('@/admin/src/ajax-save');
	});
	document.dispatchEvent(new window.Event('DOMContentLoaded'));
	jest.runOnlyPendingTimers();
}

describe('ajax-save', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		window.ajaxurl = 'https://x.test/admin-ajax.php';
		window.fotogridsAjaxSave = {
			strings: {
				youHaveUnsavedChanges: 'Unsaved changes',
				saveFailed: 'Save failed',
				fixValidationErrors: 'Fix errors first',
				saving: 'Saving…',
				saved: 'Saved',
			},
		};
		buildEditScreenDom();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete window.FotoGridsAjaxSave;
		delete window.fotogridsToast;
		document.body.className = '';
		document.body.innerHTML = '';
	});

	it('exposes the public API after init', () => {
		loadAndInit();
		expect(typeof window.FotoGridsAjaxSave.save).toBe('function');
		expect(typeof window.FotoGridsAjaxSave.showUnsavedChanges).toBe(
			'function'
		);
		expect(typeof window.FotoGridsAjaxSave.hideUnsavedChanges).toBe(
			'function'
		);
	});

	it('does nothing on a non-collection screen', () => {
		document.body.className = 'post-type-post';
		loadAndInit();
		// API is still defined (assigned at IIFE end) but the unsaved container is not injected
		expect(
			document.getElementById('fotogrids-unsaved-changes')
		).toBeNull();
	});

	it('injects the unsaved-changes container into the submit box', () => {
		loadAndInit();
		expect(
			document.getElementById('fotogrids-unsaved-changes')
		).not.toBeNull();
	});

	it('seeds the collection state from item elements', () => {
		loadAndInit();
		jest.advanceTimersByTime(600);
		expect(window.FotoGridsCollectionState.items.ids).toEqual(['10', '11']);
	});

	it('shows and hides the unsaved-changes indicator', () => {
		loadAndInit();
		window.FotoGridsAjaxSave.showUnsavedChanges('form');
		const box = document.getElementById('fotogrids-unsaved-changes');
		expect(box.style.display).not.toBe('none');
		window.FotoGridsAjaxSave.hideUnsavedChanges();
		expect(box.style.display).toBe('none');
	});

	it('posts to ajaxurl and handles a successful save', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						data: { post_title: 'My Gallery', post_type: 'fotogrids_gallery' },
					}),
			})
		);
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		loadAndInit();
		window.FotoGridsAjaxSave.save();
		expect(global.fetch).toHaveBeenCalledWith(
			'https://x.test/admin-ajax.php',
			expect.objectContaining({ method: 'POST' })
		);
		// settle the fetch -> handleSaveSuccess path
		for (let i = 0; i < 8; i++) await Promise.resolve();
		jest.runOnlyPendingTimers();
		// the page title is updated from the saved post_title
		expect(document.title).toContain('My Gallery');
	});

	it('handles a server-reported failure (success:false)', async () => {
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: false,
						data: { message: 'Server said no' },
					}),
			})
		);
		loadAndInit();
		window.FotoGridsAjaxSave.save();
		for (let i = 0; i < 8; i++) await Promise.resolve();
		expect(window.fotogridsToast.error).toHaveBeenCalled();
	});

	it('reacts to the autosave input toggling', () => {
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = 'fotogrids_autosave';
		input.value = '1';
		document.getElementById('post').appendChild(input);
		loadAndInit();
		// seed reads the input (value '1' -> autosave on)
		expect(window.FotoGridsCollectionState.autosave.enabled).toBe(true);
		// flipping it off via a change event updates the state
		input.value = '0';
		input.dispatchEvent(new window.Event('change', { bubbles: true }));
		expect(window.FotoGridsCollectionState.autosave.enabled).toBe(false);
	});

	it('blocks save and toasts when validation errors are present', () => {
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		window.FotoGridsValidationErrors = { columns: { hasErrors: true } };
		loadAndInit();

		global.fetch = jest.fn();
		const result = window.FotoGridsAjaxSave.save();
		expect(result).toBe(false);
		expect(window.fotogridsToast.error).toHaveBeenCalled();
		expect(global.fetch).not.toHaveBeenCalled();
		delete window.FotoGridsValidationErrors;
	});

	it('handles a save network failure gracefully', async () => {
		const err = jest.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.reject(new Error('down')));
		loadAndInit();
		window.FotoGridsAjaxSave.save();
		// the fetch rejection -> handleSaveError -> console.error settles a few
		// microtasks later; flush them BEFORE restoring the spy so the expected
		// error log is swallowed rather than printed.
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(err).toHaveBeenCalledWith('Save error:', expect.any(Error));
		err.mockRestore();
	});

	it('adds a quick-save admin-bar button that triggers a save', () => {
		const fetchMock = jest.fn(() => new Promise(() => {}));
		global.fetch = fetchMock;
		loadAndInit();
		const quick = document.getElementById('fotogrids-quick-save');
		expect(quick).not.toBeNull();
		quick.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		expect(fetchMock).toHaveBeenCalled();
	});

	it('intercepts the Update button click and saves via AJAX', () => {
		const fetchMock = jest.fn(() => new Promise(() => {}));
		global.fetch = fetchMock;
		loadAndInit();
		// original_post_status='publish' (not auto-draft) -> intercept fires
		document
			.getElementById('save-post')
			.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		expect(fetchMock).toHaveBeenCalled();
	});

	it('updates the page heading + heeds redirect on a rich success payload', async () => {
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						data: {
							post_title: 'Renamed',
							post_type: 'fotogrids_gallery',
							post_id: 42,
							message: 'All good',
							redirect_url: '/wp-admin/post.php?post=999&action=edit',
						},
					}),
			})
		);
		loadAndInit();
		window.FotoGridsAjaxSave.save();
		for (let i = 0; i < 12; i++) await Promise.resolve();
		// handleSaveSuccess ran: the page heading reflects the new title and the
		// redirect URL was applied to history.
		expect(document.querySelector('.wrap h1').textContent).toContain(
			'Renamed'
		);
		expect(window.fotogridsToast.success).toHaveBeenCalled();
		expect(window.location.href).toContain('post=999');
	});

	it('disables save buttons while validation errors exist', () => {
		window.FotoGridsValidationErrors = { col: { hasErrors: true } };
		loadAndInit();
		// initValidationErrorMonitoring runs the check on init + on a 500ms timer
		jest.advanceTimersByTime(600);
		const publish = document.getElementById('publish');
		// the save button gets disabled / aria-disabled while errors exist
		expect(
			publish.disabled || publish.getAttribute('aria-disabled') === 'true'
		).toBe(true);
		delete window.FotoGridsValidationErrors;
	});

	it('tracks form input changes as unsaved', () => {
		loadAndInit();
		const titleInput = document.querySelector('input[name="post_title"]');
		titleInput.value = 'Changed';
		titleInput.dispatchEvent(new window.Event('input', { bubbles: true }));
		expect(window.FotoGridsCollectionState.unsavedChanges.has()).toBe(true);
	});
});
