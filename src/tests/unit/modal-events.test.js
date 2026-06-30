/**
 * Tests for components/shared/Modal/api/events.js
 */
import { emit, on, off } from '@/admin/src/components/shared/Modal/api/events';

describe('Modal events', () => {
	it('emits a prefixed CustomEvent on document', () => {
		const handler = jest.fn();
		document.addEventListener('fotogrids:admin:modal:opened', handler);
		emit('opened', { id: 'x' });
		expect(handler).toHaveBeenCalled();
		expect(handler.mock.calls[0][0].detail).toEqual({ id: 'x' });
		document.removeEventListener('fotogrids:admin:modal:opened', handler);
	});

	it('on() subscribes and returns an unsubscribe fn', () => {
		const handler = jest.fn();
		const unsub = on('closed', handler);
		emit('closed');
		expect(handler).toHaveBeenCalledTimes(1);
		unsub();
		emit('closed');
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('off() removes a handler', () => {
		const handler = jest.fn();
		on('confirmed', handler);
		off('confirmed', handler);
		emit('confirmed');
		expect(handler).not.toHaveBeenCalled();
	});

	it('emit defaults detail to an empty object', () => {
		const handler = jest.fn();
		on('opened', handler);
		emit('opened');
		expect(handler.mock.calls[0][0].detail).toEqual({});
	});
});
