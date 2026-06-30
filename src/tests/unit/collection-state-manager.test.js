/**
 * Tests for src/assets/admin/src/collection-state-manager.js
 *
 * IIFE attaching window.FotoGridsCollectionState. We re-require it in a fresh
 * module registry per test so each test starts from a clean state object.
 */

function loadFreshState() {
	delete window.FotoGridsCollectionState;
	jest.isolateModules(() => {
		require('@/admin/src/collection-state-manager');
	});
	return window.FotoGridsCollectionState;
}

describe('collection-state-manager', () => {
	let S;

	beforeEach(() => {
		jest.useFakeTimers();
		S = loadFreshState();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete window.FotoGridsAjaxSave;
	});

	describe('items', () => {
		it('initItems sets current and initial state with no diff', () => {
			S.items.initItems([1, 2, 3]);
			expect(S.items.ids).toEqual([1, 2, 3]);
			expect(S.items.hasChanged()).toBe(false);
		});

		it('setItems replaces ids and marks a change', () => {
			S.items.initItems([1, 2]);
			S.items.setItems([1, 2, 3]);
			expect(S.items.ids).toEqual([1, 2, 3]);
			expect(S.items.hasChanged()).toBe(true);
		});

		it('addItem appends unique ids only', () => {
			S.items.initItems([1]);
			S.items.addItem(2);
			S.items.addItem(2);
			expect(S.items.ids).toEqual([1, 2]);
		});

		it('removeItem drops an existing id and ignores missing ones', () => {
			S.items.initItems([1, 2, 3]);
			S.items.removeItem(2);
			S.items.removeItem(99);
			expect(S.items.ids).toEqual([1, 3]);
		});

		it('reorderItems detects order changes', () => {
			S.items.initItems([1, 2, 3]);
			S.items.reorderItems([3, 2, 1]);
			expect(S.items.hasChanged()).toBe(true);
		});

		it('reset restores the initial ids', () => {
			S.items.initItems([1, 2]);
			S.items.setItems([1, 2, 3, 4]);
			S.items.reset();
			expect(S.items.ids).toEqual([1, 2]);
			expect(S.items.hasChanged()).toBe(false);
		});

		it('save promotes current ids to the new baseline', () => {
			S.items.initItems([1]);
			S.items.setItems([1, 2]);
			S.items.save();
			expect(S.items.hasChanged()).toBe(false);
			expect(S.items.initialIds).toEqual([1, 2]);
		});

		it('warns and no-ops on non-array input', () => {
			const warn = jest
				.spyOn(console, 'warn')
				.mockImplementation(() => {});
			S.items.setItems('nope');
			S.items.initItems(42);
			S.items.reorderItems(null);
			expect(warn).toHaveBeenCalledTimes(3);
			warn.mockRestore();
		});
	});

	describe('unsavedChanges', () => {
		it('set updates the flag and the source', () => {
			S.unsavedChanges.set(true, 'form');
			expect(S.unsavedChanges.has()).toBe(true);
			expect(S.unsavedChanges.sources.form).toBe(true);
		});

		it('markChanged forces true for a source', () => {
			S.unsavedChanges.markChanged('settings');
			expect(S.unsavedChanges.sources.settings).toBe(true);
			expect(S.unsavedChanges.has()).toBe(true);
		});

		it('clear resets the flag and all sources', () => {
			S.unsavedChanges.markChanged('form');
			S.unsavedChanges.clear();
			expect(S.unsavedChanges.has()).toBe(false);
			expect(S.unsavedChanges.sources).toEqual({
				items: false,
				form: false,
				settings: false,
			});
		});
	});

	describe('autosave', () => {
		it('enable / disable toggle the flag', () => {
			S.autosave.enable();
			expect(S.autosave.enabled).toBe(true);
			S.autosave.disable();
			expect(S.autosave.enabled).toBe(false);
		});

		it('set(true) enables and set(false) disables', () => {
			S.autosave.set(true);
			expect(S.autosave.enabled).toBe(true);
			S.autosave.set(false);
			expect(S.autosave.enabled).toBe(false);
		});

		it('trigger does nothing while disabled', () => {
			const cb = jest.fn();
			S.autosave.trigger(cb);
			jest.runAllTimers();
			expect(cb).not.toHaveBeenCalled();
		});

		it('trigger ignores a non-function callback', () => {
			S.autosave.enable();
			expect(() => S.autosave.trigger('not-a-fn')).not.toThrow();
		});

		it('trigger debounces and calls FotoGridsAjaxSave.save after the delay', () => {
			const save = jest.fn();
			window.FotoGridsAjaxSave = { save };
			S.autosave.enable();
			S.autosave.trigger(() => {});
			S.autosave.trigger(() => {}); // resets the timer
			jest.advanceTimersByTime(2000);
			expect(save).toHaveBeenCalledTimes(1);
		});

		it('disable clears a pending timer', () => {
			const save = jest.fn();
			window.FotoGridsAjaxSave = { save };
			S.autosave.enable();
			S.autosave.trigger(() => {});
			S.autosave.disable();
			jest.advanceTimersByTime(5000);
			expect(save).not.toHaveBeenCalled();
		});
	});

	describe('listeners', () => {
		it('on/off register and remove callbacks', () => {
			const cb = jest.fn();
			S.on('items', cb);
			S.items.setItems([1]);
			expect(cb).toHaveBeenCalled();

			cb.mockClear();
			S.off('items', cb);
			S.items.setItems([2]);
			expect(cb).not.toHaveBeenCalled();
		});

		it('ignores unknown events and non-function callbacks', () => {
			expect(() => S.on('nope', () => {})).not.toThrow();
			expect(() => S.on('items', 'x')).not.toThrow();
			expect(() => S.off('nope', () => {})).not.toThrow();
		});

		it('isolates listener errors so others still fire', () => {
			const err = jest
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const good = jest.fn();
			S.on('items', () => {
				throw new Error('bad listener');
			});
			S.on('items', good);
			S.items.setItems([1]);
			expect(good).toHaveBeenCalled();
			expect(err).toHaveBeenCalled();
			err.mockRestore();
		});

		it('the built-in items listener rolls item changes into unsavedChanges', () => {
			S.items.initItems([1, 2]);
			S.items.setItems([1, 2, 3]);
			expect(S.unsavedChanges.sources.items).toBe(true);
			expect(S.unsavedChanges.hasChanges).toBe(true);
		});
	});
});
