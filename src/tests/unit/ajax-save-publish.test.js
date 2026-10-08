/**
 * Tests for Publish / Update pressed while a collection save is in flight
 * (src/assets/admin/src/ajax-save.js).
 *
 * Kept apart from ajax-save.test.js: every loadAndInit() leaves a module
 * instance listening for DOMContentLoaded, and an instance from an earlier
 * test re-binds to the next test's form. These tests settle every save they
 * start so no instance is left holding a press.
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

function pressPublish() {
	const form = document.getElementById('post');
	document.getElementById('publish').focus();
	form.dispatchEvent(
		new window.Event('submit', { bubbles: true, cancelable: true })
	);
}

function deferredSave() {
	let resolve;
	global.fetch = jest.fn(
		() =>
			new Promise((res) => {
				resolve = res;
			})
	);
	return async () => {
		resolve({
			ok: true,
			json: () => Promise.resolve({ success: true, data: {} }),
		});
		for (let i = 0; i < 10; i++) await Promise.resolve();
	};
}

describe('ajax-save: Publish during a save', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		window.ajaxurl = 'https://x.test/admin-ajax.php';
		window.fotogridsAdmin = { autosave: '' };
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		window.fotogridsAjaxSave = { strings: { saveFailed: 'Save failed' } };
		buildEditScreenDom();
	});

	it('keeps Publish enabled while a save is in flight', async () => {
		const settle = deferredSave();
		loadAndInit();
		window.FotoGridsAjaxSave.save();

		jest.advanceTimersByTime(1000);
		expect(document.getElementById('publish').disabled).toBe(false);
		expect(document.getElementById('save-post').disabled).toBe(true);
		expect(
			document.querySelector('input[name="post_title"]').disabled
		).toBe(true);
		await settle();
	});

	it('holds Publish pressed during a save and submits it once the save returns', async () => {
		const settle = deferredSave();
		loadAndInit();
		const form = document.getElementById('post');
		form.requestSubmit = jest.fn();
		const reachedWordPress = jest.fn();
		form.addEventListener('submit', reachedWordPress);
		window.FotoGridsAjaxSave.save();

		pressPublish();
		pressPublish();
		expect(reachedWordPress).not.toHaveBeenCalled();
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(form.requestSubmit).not.toHaveBeenCalled();

		await settle();

		expect(form.requestSubmit).toHaveBeenCalledTimes(1);
		expect(form.requestSubmit).toHaveBeenCalledWith(
			document.getElementById('publish')
		);
		expect(
			document.querySelector('input[name="post_title"]').disabled
		).toBe(false);
	});

	it('submits a held Publish after the time limit when the save hangs', async () => {
		const settle = deferredSave();
		loadAndInit();
		const form = document.getElementById('post');
		form.requestSubmit = jest.fn();
		window.FotoGridsAjaxSave.save();

		pressPublish();
		jest.advanceTimersByTime(9000);
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(form.requestSubmit).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1000);
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(form.requestSubmit).toHaveBeenCalledTimes(1);
		expect(
			document.querySelector('input[name="post_title"]').disabled
		).toBe(false);
		await settle();
	});

	it('releases a held Publish past a save that is still running, and starts no save while it waits', async () => {
		const settle = deferredSave();
		loadAndInit();
		const form = document.getElementById('post');
		const reachedWordPress = jest.fn();
		form.addEventListener('submit', reachedWordPress);
		form.requestSubmit = jest.fn((submitter) => {
			submitter.focus();
			form.dispatchEvent(
				new window.Event('submit', { bubbles: true, cancelable: true })
			);
		});
		window.FotoGridsAjaxSave.save();
		global.fetch.mockClear();

		pressPublish();
		expect(window.FotoGridsAjaxSave.save()).toBe(false);
		expect(global.fetch).not.toHaveBeenCalled();

		jest.advanceTimersByTime(10000);
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(reachedWordPress).toHaveBeenCalledTimes(1);
		await settle();
	});

	it('starts no save once Publish has gone through', () => {
		global.fetch = jest.fn(() => new Promise(() => {}));
		loadAndInit();

		pressPublish();
		expect(window.FotoGridsAjaxSave.save()).toBe(false);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('drops a pending autosave when Update submits the form', () => {
		window.fotogridsAdmin = { autosave: '1' };
		global.fetch = jest.fn(() => new Promise(() => {}));
		loadAndInit();
		global.fetch.mockClear();

		const title = document.querySelector('input[name="post_title"]');
		title.value = 'Renamed';
		title.dispatchEvent(new window.Event('change', { bubbles: true }));

		const form = document.getElementById('post');
		document.getElementById('publish').focus();
		form.dispatchEvent(
			new window.Event('submit', { bubbles: true, cancelable: true })
		);

		jest.advanceTimersByTime(5000);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('lets Publish through at once when no save is running', () => {
		global.fetch = jest.fn();
		loadAndInit();
		const form = document.getElementById('post');
		form.requestSubmit = jest.fn();
		const reachedWordPress = jest.fn();
		form.addEventListener('submit', reachedWordPress);

		pressPublish();
		expect(reachedWordPress).toHaveBeenCalledTimes(1);
		expect(form.requestSubmit).not.toHaveBeenCalled();
	});
});
