/**
 * Tests for src/assets/admin/src/toast-manager.js
 */
import toastManager from '@/admin/src/toast-manager';

describe('toast-manager', () => {
	beforeEach(() => {
		toastManager.clear();
	});

	it('attaches a singleton to window.fotogridsToast', () => {
		expect(window.fotogridsToast).toBe(toastManager);
	});

	describe('add', () => {
		it('adds a toast and returns its id', () => {
			const id = toastManager.add({ message: 'Hi', type: 'success' });
			expect(id).toMatch(/^toast-\d+$/);
			expect(toastManager.toasts).toHaveLength(1);
			expect(toastManager.toasts[0]).toMatchObject({
				message: 'Hi',
				type: 'success',
			});
		});

		it('warns and returns null with no message', () => {
			const warn = jest
				.spyOn(console, 'warn')
				.mockImplementation(() => {});
			expect(toastManager.add({})).toBeNull();
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});

		it('coerces the message to a string', () => {
			toastManager.add({ message: 123 });
			expect(toastManager.toasts[0].message).toBe('123');
		});

		it('falls back to "info" for an invalid type', () => {
			toastManager.add({ message: 'x', type: 'bogus' });
			expect(toastManager.toasts[0].type).toBe('info');
		});

		it('falls back to 5000ms for an invalid duration', () => {
			toastManager.add({ message: 'x', duration: 'soon' });
			expect(toastManager.toasts[0].duration).toBe(5000);
		});

		it('accepts a zero duration (no auto-dismiss)', () => {
			toastManager.add({ message: 'x', duration: 0 });
			expect(toastManager.toasts[0].duration).toBe(0);
		});

		it('falls back to 5000ms for a negative duration', () => {
			toastManager.add({ message: 'x', duration: -10 });
			expect(toastManager.toasts[0].duration).toBe(5000);
		});
	});

	describe('remove / clear', () => {
		it('removes a toast by id', () => {
			const id = toastManager.add({ message: 'a' });
			toastManager.add({ message: 'b' });
			toastManager.remove(id);
			expect(toastManager.toasts).toHaveLength(1);
			expect(toastManager.toasts[0].message).toBe('b');
		});

		it('no-ops removing an unknown id', () => {
			toastManager.add({ message: 'a' });
			toastManager.remove('toast-999');
			expect(toastManager.toasts).toHaveLength(1);
		});

		it('clear empties all toasts', () => {
			toastManager.add({ message: 'a' });
			toastManager.add({ message: 'b' });
			toastManager.clear();
			expect(toastManager.toasts).toHaveLength(0);
		});
	});

	describe('subscribe / notify', () => {
		it('notifies subscribers with a snapshot on change', () => {
			const cb = jest.fn();
			const unsub = toastManager.subscribe(cb);
			toastManager.add({ message: 'a' });
			expect(cb).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ message: 'a' }),
				])
			);
			unsub();
			cb.mockClear();
			toastManager.add({ message: 'b' });
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe('type shortcuts', () => {
		it('success/error/warning/info set the right type and default durations', () => {
			toastManager.success('s');
			toastManager.error('e');
			toastManager.warning('w');
			toastManager.info('i');
			const byType = Object.fromEntries(
				toastManager.toasts.map((t) => [t.type, t.duration])
			);
			expect(byType.success).toBe(5000);
			expect(byType.error).toBe(7000);
			expect(byType.warning).toBe(6000);
			expect(byType.info).toBe(5000);
		});

		it('respects an explicit duration override', () => {
			toastManager.error('e', 0);
			expect(toastManager.toasts[0].duration).toBe(0);
		});
	});
});
