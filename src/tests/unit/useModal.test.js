/**
 * Tests for components/shared/Modal/hooks/useModal.js
 *
 * The hook returns promise-resolving wrappers around modalRegistry. We render a
 * tiny host to obtain the API, then drive each builder by opening a modal and
 * invoking the registry entry's onConfirm/onSubmit/onClose callbacks.
 */
import { useModal } from '@/admin/src/components/shared/Modal/hooks/useModal';
import { modalRegistry } from '@/admin/src/components/shared/Modal/api/modalRegistry';
import { renderElement, act } from '@tests/helpers/render-component';

const h = wp.element.createElement;

let api;
function Host() {
	api = useModal();
	return h('div', null, 'host');
}

const lastEntry = () => modalRegistry.list().at(-1);

describe('useModal', () => {
	beforeEach(() => {
		modalRegistry.closeAll();
		renderElement(h(Host));
	});

	it('exposes the imperative surface', () => {
		expect(typeof api.open).toBe('function');
		expect(typeof api.confirm).toBe('function');
		expect(typeof api.prompt).toBe('function');
		expect(typeof api.alert).toBe('function');
		expect(typeof api.danger).toBe('function');
		expect(typeof api.success).toBe('function');
	});

	it('open/close/closeAll proxy the registry', () => {
		const handle = api.open({ id: 'x' });
		expect(modalRegistry.list().some((e) => e.id === 'x')).toBe(true);
		api.close(handle.id);
		expect(modalRegistry.list().some((e) => e.id === 'x')).toBe(false);
		api.open({ id: 'a' });
		api.open({ id: 'b' });
		api.closeAll();
		expect(modalRegistry.list()).toHaveLength(0);
	});

	it('close() with no id is a no-op (returns null)', () => {
		expect(api.close()).toBeNull();
	});

	it('confirm resolves true when confirmed and runs opts.onConfirm', async () => {
		const onConfirm = jest.fn();
		const p = api.confirm({ onConfirm });
		const entry = lastEntry();
		await act(async () => {
			await entry.options.onConfirm();
		});
		await expect(p).resolves.toBe(true);
		expect(onConfirm).toHaveBeenCalled();
	});

	it('confirm resolves false when closed without confirming', async () => {
		const p = api.danger({});
		const entry = lastEntry();
		entry.options.onClose('overlay');
		await expect(p).resolves.toBe(false);
	});

	it('prompt resolves the submitted value and runs opts.onSubmit', async () => {
		const onSubmit = jest.fn();
		const p = api.prompt({ onSubmit });
		const entry = lastEntry();
		await act(async () => {
			await entry.options.onSubmit('typed');
		});
		await expect(p).resolves.toBe('typed');
		expect(onSubmit).toHaveBeenCalledWith('typed');
	});

	it('prompt resolves null when closed without submitting', async () => {
		const p = api.prompt({});
		lastEntry().options.onClose('esc');
		await expect(p).resolves.toBeNull();
	});

	it('alert resolves on close', async () => {
		const onClose = jest.fn();
		const p = api.alert({ onClose });
		lastEntry().options.onClose('close-button');
		await expect(p).resolves.toBeUndefined();
		expect(onClose).toHaveBeenCalledWith('close-button');
	});

	it('confirm without opts works (no onConfirm/onClose handlers)', async () => {
		const p = api.confirm();
		const entry = lastEntry();
		await act(async () => {
			await entry.options.onConfirm();
		});
		await expect(p).resolves.toBe(true);
	});

	it('prompt/alert without opts resolve on close (no handlers)', async () => {
		const pp = api.prompt();
		lastEntry().options.onClose('overlay');
		await expect(pp).resolves.toBeNull();

		const pa = api.alert();
		lastEntry().options.onClose('esc');
		await expect(pa).resolves.toBeUndefined();
	});

	it('confirm onClose with reason "confirm" does not double-resolve false', async () => {
		const p = api.confirm({});
		const entry = lastEntry();
		// simulate the confirm path firing onClose('confirm')
		entry.options.onClose('confirm');
		await act(async () => {
			await entry.options.onConfirm();
		});
		await expect(p).resolves.toBe(true);
	});

	it('variant shortcuts open with the right type', () => {
		api.warning({ id: 'w' });
		api.success({ id: 's' });
		api.info({ id: 'i' });
		api.question({ id: 'q' });
		const types = Object.fromEntries(
			modalRegistry.list().map((e) => [e.id, e.options.type])
		);
		expect(types.w).toBe('confirm');
		expect(types.s).toBe('alert');
		expect(types.i).toBe('alert');
		expect(types.q).toBe('confirm');
	});
});
