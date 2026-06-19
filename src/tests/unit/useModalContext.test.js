/**
 * Tests for components/shared/Modal/hooks/useModalContext.js
 */
import {
	ModalContext,
	useModalContext,
} from '@/admin/src/components/shared/Modal/hooks/useModalContext';
import { renderElement } from '@tests/helpers/render-component';

const h = wp.element.createElement;

let captured;
function Consumer() {
	captured = useModalContext();
	return h('div', null, 'c');
}

describe('useModalContext', () => {
	beforeEach(() => {
		captured = undefined;
	});

	it('returns the provided context value', () => {
		const value = { id: 'm1', close: () => {} };
		renderElement(
			h(ModalContext.Provider, { value }, h(Consumer))
		);
		expect(captured).toBe(value);
	});

	it('warns and returns null outside a provider', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		renderElement(h(Consumer));
		expect(captured).toBeNull();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('outside <Modal>')
		);
		warn.mockRestore();
	});
});
