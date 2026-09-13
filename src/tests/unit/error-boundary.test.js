/**
 * Unit tests for the shared admin error boundary.
 *
 * Covers the boundary itself and `withErrorBoundary`, which defers the render
 * callback into the boundary so a throw in the callback body is caught too.
 */
import '@/admin/plain/error-boundary';
import { renderElement } from '@tests/helpers/render-component';

const { createElement: h } = wp.element;

const Boom = () => {
	throw new TypeError('boom');
};

const Fine = ({ text }) => h('p', { className: 'fine' }, text);

describe('FotoGridsAdmin.ErrorBoundary', () => {
	let ErrorBoundary;
	let withErrorBoundary;

	beforeEach(() => {
		({ ErrorBoundary, withErrorBoundary } = window.FotoGridsAdmin);
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('renders its children when nothing throws', () => {
		const handle = renderElement(
			h(ErrorBoundary, null, h(Fine, { text: 'all good' }))
		);

		expect(handle.container.textContent).toContain('all good');
		expect(
			handle.container.querySelector('.fotogrids-error-boundary')
		).toBeNull();

		handle.unmount();
	});

	it('renders the fallback instead of an empty container when a child throws', () => {
		const handle = renderElement(h(ErrorBoundary, null, h(Boom)));

		const fallback = handle.container.querySelector(
			'.fotogrids-error-boundary'
		);
		expect(fallback).not.toBeNull();
		expect(fallback.textContent).toContain(
			'This part of the screen failed to load.'
		);
		expect(
			fallback.querySelector('button.button-secondary')
		).not.toBeNull();

		handle.unmount();
	});

	it('reports the error to the console with its label', () => {
		const handle = renderElement(
			h(ErrorBoundary, { label: 'gallery metabox' }, h(Boom))
		);

		expect(console.error).toHaveBeenCalled();
		const reported = console.error.mock.calls.some(
			(args) =>
				typeof args[0] === 'string' &&
				args[0].includes('FotoGrids: render error in gallery metabox')
		);
		expect(reported).toBe(true);

		handle.unmount();
	});

	it('catches a throw inside the deferred render callback', () => {
		const handle = renderElement(
			withErrorBoundary({ label: 'a control' }, () => {
				throw new TypeError('thrown while building the element');
			})
		);

		expect(
			handle.container.querySelector('.fotogrids-error-boundary')
		).not.toBeNull();

		handle.unmount();
	});

	it('leaves sibling subtrees usable when one of them throws', () => {
		const rows = [
			withErrorBoundary({ key: 'first' }, () =>
				h(Fine, { text: 'first row' })
			),
			withErrorBoundary({ key: 'second' }, () => {
				throw new TypeError('boom');
			}),
			withErrorBoundary({ key: 'third' }, () =>
				h(Fine, { text: 'third row' })
			),
		];

		const handle = renderElement(h('div', null, rows));

		expect(handle.container.querySelectorAll('.fine').length).toBe(2);
		expect(handle.container.textContent).toContain('first row');
		expect(handle.container.textContent).toContain('third row');
		expect(
			handle.container.querySelectorAll('.fotogrids-error-boundary').length
		).toBe(1);

		handle.unmount();
	});
});
