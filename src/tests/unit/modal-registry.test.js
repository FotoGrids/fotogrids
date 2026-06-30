/**
 * Tests for components/shared/Modal/api/modalRegistry.js
 */
import { modalRegistry } from '@/admin/src/components/shared/Modal/api/modalRegistry';

describe('modalRegistry', () => {
	afterEach(() => {
		modalRegistry.closeAll();
	});

	it('subscribe receives the current snapshot immediately and on changes', () => {
		const cb = jest.fn();
		const unsub = modalRegistry.subscribe(cb);
		expect(cb).toHaveBeenCalledWith([]);
		modalRegistry.open({ id: 'a' });
		expect(cb).toHaveBeenLastCalledWith([
			expect.objectContaining({ id: 'a' }),
		]);
		unsub();
		cb.mockClear();
		modalRegistry.open({ id: 'b' });
		expect(cb).not.toHaveBeenCalled();
	});

	it('open returns a handle with id, close and update', () => {
		const handle = modalRegistry.open({ id: 'm1', options: 1 });
		expect(handle.id).toBe('m1');
		expect(typeof handle.close).toBe('function');
		expect(typeof handle.update).toBe('function');
		expect(modalRegistry.list()).toHaveLength(1);
	});

	it('generates an id when none is provided', () => {
		const handle = modalRegistry.open({});
		expect(handle.id).toMatch(/^fg-modal-imperative-\d+$/);
	});

	it('update merges new options into the matching entry', () => {
		const handle = modalRegistry.open({ id: 'm', title: 'A' });
		handle.update({ title: 'B', extra: true });
		const entry = modalRegistry.list().find((e) => e.id === 'm');
		expect(entry.options).toMatchObject({ title: 'B', extra: true });
	});

	it('update is a no-op for an unknown id', () => {
		const cb = jest.fn();
		modalRegistry.open({ id: 'm' });
		modalRegistry.subscribe(cb);
		cb.mockClear();
		modalRegistry.update('nope', { x: 1 });
		expect(cb).not.toHaveBeenCalled();
	});

	it('close removes a single entry', () => {
		const h = modalRegistry.open({ id: 'm' });
		modalRegistry.open({ id: 'n' });
		h.close();
		expect(modalRegistry.list().map((e) => e.id)).toEqual(['n']);
	});

	it('close is a no-op for an unknown id', () => {
		modalRegistry.open({ id: 'm' });
		const before = modalRegistry.list().length;
		modalRegistry.close('nope');
		expect(modalRegistry.list()).toHaveLength(before);
	});

	it('closeAll empties the registry', () => {
		modalRegistry.open({ id: 'm' });
		modalRegistry.open({ id: 'n' });
		modalRegistry.closeAll();
		expect(modalRegistry.list()).toHaveLength(0);
	});

	it('closeAll is a no-op when already empty', () => {
		const cb = jest.fn();
		modalRegistry.subscribe(cb);
		cb.mockClear();
		modalRegistry.closeAll();
		expect(cb).not.toHaveBeenCalled();
	});
});
