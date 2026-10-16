/**
 * Tests for the settings leave guard:
 * src/assets/admin/src/components/shared/SidebarTabs/elements/unsaved-changes.js
 * and the SaveBar that feeds it.
 */
import React, { act } from 'react';
import SaveBar from '@/admin/src/components/shared/SidebarTabs/elements/SaveBar';
import {
	confirmLeave,
	hasUnsavedChanges,
} from '@/admin/src/components/shared/SidebarTabs/elements/unsaved-changes';
import { renderElement } from '@tests/helpers/render-component';

const h = React.createElement;
const modalConfirm = jest.fn();

const bar = (props = {}) => {
	const onSave = props.onSave || jest.fn(() => Promise.resolve(true));
	const onDiscard = props.onDiscard || jest.fn();
	const view = renderElement(
		h(SaveBar, { dirty: true, ...props, onSave, onDiscard })
	);
	return { view, onSave, onDiscard };
};

const leave = async (label) => {
	let result;
	await act(async () => {
		result = await confirmLeave(label);
	});
	return result;
};

/** Answer the next dialog the way the user would. */
const answer = (reason) =>
	modalConfirm.mockImplementationOnce((opts) => {
		opts.onClose(reason);
		return Promise.resolve('confirm' === reason);
	});

beforeEach(() => {
	window.fotogridsAdmin = { autosave: '0' };
	window.FotoGridsAdmin = { modal: { confirm: modalConfirm } };
	modalConfirm.mockReset();
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('confirmLeave', () => {
	it('lets the user leave at once when nothing is unsaved', async () => {
		const { view, onSave } = bar({ dirty: false });

		expect(hasUnsavedChanges()).toBe(false);
		expect(await leave('Sharing')).toBe(true);
		expect(modalConfirm).not.toHaveBeenCalled();
		expect(onSave).not.toHaveBeenCalled();
		view.unmount();
	});

	it('forgets a save bar once it unmounts', async () => {
		const { view } = bar();
		expect(hasUnsavedChanges()).toBe(true);
		view.unmount();

		expect(hasUnsavedChanges()).toBe(false);
		expect(await leave('Sharing')).toBe(true);
	});

	it('saves without asking when Autosave is on', async () => {
		window.fotogridsAdmin.autosave = '1';
		const { view, onSave } = bar();

		expect(await leave('Sharing')).toBe(true);
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(modalConfirm).not.toHaveBeenCalled();
		view.unmount();
	});

	it('stays when the save fails', async () => {
		window.fotogridsAdmin.autosave = '1';
		const { view } = bar({ onSave: () => Promise.resolve(false) });

		expect(await leave('Sharing')).toBe(false);
		view.unmount();
	});

	it('asks with Autosave off, naming the view being left', async () => {
		answer('confirm');
		const { view, onSave } = bar();

		expect(await leave('Album Defaults')).toBe(true);
		expect(modalConfirm.mock.calls[0][0]).toMatchObject({
			title: 'Unsaved changes',
			confirmLabel: 'Save changes',
			cancelLabel: 'Discard changes',
		});
		expect(modalConfirm.mock.calls[0][0].message).toContain(
			'Album Defaults'
		);
		expect(onSave).toHaveBeenCalledTimes(1);
		view.unmount();
	});

	it('discards when the user chooses Discard changes', async () => {
		answer('cancel');
		const { view, onSave, onDiscard } = bar();

		expect(await leave('Sharing')).toBe(true);
		expect(onDiscard).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
		view.unmount();
	});

	it.each(['esc', 'overlay', 'close-button'])(
		'stays when the dialog is closed by %s',
		async (reason) => {
			answer(reason);
			const { view, onSave, onDiscard } = bar();

			expect(await leave('Sharing')).toBe(false);
			expect(onSave).not.toHaveBeenCalled();
			expect(onDiscard).not.toHaveBeenCalled();
			view.unmount();
		}
	);

	it('stays when the chosen save fails', async () => {
		answer('confirm');
		const { view } = bar({ onSave: () => Promise.resolve(false) });

		expect(await leave('Sharing')).toBe(false);
		view.unmount();
	});

	it('asks instead of saving a form that cannot be saved', async () => {
		window.fotogridsAdmin.autosave = '1';
		answer('confirm');
		const { view, onSave } = bar({ disabled: true });

		expect(await leave('Sharing')).toBe(false);
		expect(modalConfirm).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
		view.unmount();
	});

	it('waits for a save in flight before deciding', async () => {
		window.fotogridsAdmin.autosave = '1';
		const { view, onSave } = bar({ dirty: false, saving: true });

		let settled = false;
		let pending;
		act(() => {
			pending = confirmLeave('Sharing').then((result) => {
				settled = result;
			});
		});
		await act(async () => Promise.resolve());
		expect(settled).toBe(false);

		view.rerender(h(SaveBar, { dirty: false, saving: false, onSave }));
		await act(async () => pending);
		expect(settled).toBe(true);
		view.unmount();
	});

	it('falls back to the browser dialog without the modal API', async () => {
		delete window.FotoGridsAdmin;
		const native = jest.spyOn(window, 'confirm').mockReturnValue(false);
		const { view } = bar();

		expect(await leave('Sharing')).toBe(false);
		expect(native.mock.calls[0][0]).toContain('Sharing');
		native.mockRestore();
		view.unmount();
	});

	it('uses a generic message when no view is named', async () => {
		answer('esc');
		const { view } = bar();

		await leave();
		expect(modalConfirm.mock.calls[0][0].message).toBe(
			'You have unsaved changes. Save them before you leave?'
		);
		view.unmount();
	});
});

describe('SaveBar leaving the page', () => {
	const unload = () => {
		const event = new window.Event('beforeunload', { cancelable: true });
		window.dispatchEvent(event);
		return event;
	};

	it('warns before the page is left with unsaved changes', () => {
		const { view, onSave } = bar();

		expect(unload().defaultPrevented).toBe(true);
		expect(onSave).not.toHaveBeenCalled();
		view.unmount();
	});

	it('warns while a save is still in flight', () => {
		const { view } = bar({ dirty: false, saving: true });

		expect(unload().defaultPrevented).toBe(true);
		view.unmount();
	});

	it('starts the save at once with Autosave on', () => {
		window.fotogridsAdmin.autosave = '1';
		const { view, onSave } = bar();

		expect(unload().defaultPrevented).toBe(true);
		expect(onSave).toHaveBeenCalledTimes(1);
		view.unmount();
	});

	it('does not warn when everything is saved, or after unmounting', () => {
		const clean = bar({ dirty: false });
		expect(unload().defaultPrevented).toBe(false);
		clean.view.unmount();

		const dirty = bar();
		dirty.view.unmount();
		expect(unload().defaultPrevented).toBe(false);
	});
});
