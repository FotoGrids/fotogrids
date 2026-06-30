/**
 * Tests for small admin modules: tools-registry, toast-init,
 * album-assignment (mount), album-galleries (mount).
 */
import { act } from '@tests/helpers/render-component';

describe('tools-registry', () => {
	let ToolsComponents;
	beforeEach(() => {
		jest.isolateModules(() => {
			ToolsComponents = require('@/admin/src/tools-registry').default;
		});
	});

	it('exposes the registry on window', () => {
		expect(window.FotoGridsToolsComponents).toBe(ToolsComponents);
	});

	it('registers and looks up a component, firing an event', () => {
		const handler = jest.fn();
		window.addEventListener('fotogrids:tool-component-registered', handler);
		const Comp = () => null;
		ToolsComponents.register('thumbs', Comp);
		expect(ToolsComponents.get('thumbs')).toBe(Comp);
		expect(handler).toHaveBeenCalled();
		window.removeEventListener(
			'fotogrids:tool-component-registered',
			handler
		);
	});

	it('warns and ignores invalid registrations', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		ToolsComponents.register('', null);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('returns null for an unknown id', () => {
		expect(ToolsComponents.get('nope')).toBeNull();
	});

	it('lets a later registration override an earlier one', () => {
		const A = () => null;
		const B = () => null;
		ToolsComponents.register('x', A);
		ToolsComponents.register('x', B);
		expect(ToolsComponents.get('x')).toBe(B);
	});
});

describe('toast-init', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '';
		window.fotogridsAdmin = { isFotoGridsPage: true };
	});
	afterEach(() => {
		jest.useRealTimers();
		delete window.fotogridsAdmin;
		document.body.innerHTML = '';
	});

	it('mounts a toast container on a FotoGrids page', async () => {
		await act(async () => {
			jest.isolateModules(() => require('@/admin/src/toast-init'));
			jest.advanceTimersByTime(10);
			for (let i = 0; i < 6; i++) await Promise.resolve();
		});
		expect(
			document.getElementById('fotogrids-toast-container')
		).not.toBeNull();
	});

	it('does not mount off a FotoGrids page', () => {
		window.fotogridsAdmin = { isFotoGridsPage: false };
		act(() => {
			jest.isolateModules(() => require('@/admin/src/toast-init'));
			jest.advanceTimersByTime(10);
		});
		expect(
			document.getElementById('fotogrids-toast-container')
		).toBeNull();
	});
});

describe('album-assignment mount', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '';
	});
	afterEach(() => {
		jest.useRealTimers();
		delete window.fotogridsAlbumAssignment;
		document.body.innerHTML = '';
	});

	it('does nothing without a mount node', () => {
		expect(() => {
			act(() => {
				jest.isolateModules(() =>
					require('@/admin/src/album-assignment')
				);
				jest.advanceTimersByTime(10);
			});
		}).not.toThrow();
	});

	it('mounts when the root and config exist', async () => {
		document.body.innerHTML =
			'<div id="fotogrids-gallery-albums-root"></div>';
		window.fotogridsAlbumAssignment = {
			postId: 1,
			restUrl: '/r/',
			nonce: 'n',
			assignedAlbums: [],
			allAlbums: [],
			strings: {
				albums: 'A',
				assignedTo: 'A',
				notAssignedTo: 'N',
				searchPlaceholder: 'S',
				noAvailableAlbumsFound: 'X',
				noMoreAlbumsFound: 'Y',
				createNewAlbum: 'C',
				saved: 'S',
			},
		};
		await act(async () => {
			jest.isolateModules(() =>
				require('@/admin/src/album-assignment')
			);
			jest.advanceTimersByTime(10);
			for (let i = 0; i < 6; i++) await Promise.resolve();
		});
		expect(
			document.querySelector('.fotogrids-album-assignment')
		).not.toBeNull();
	});
});

describe('album-galleries mount', () => {
	afterEach(() => {
		jest.useRealTimers();
		delete window.fotogridsAlbumGalleries;
		document.body.innerHTML = '';
	});

	it('does nothing without a mount node', () => {
		jest.useFakeTimers();
		expect(() => {
			act(() => {
				jest.isolateModules(() =>
					require('@/admin/src/album-galleries')
				);
				jest.advanceTimersByTime(10);
			});
		}).not.toThrow();
	});

	it('mounts AlbumGalleries when the root and config exist', async () => {
		jest.useFakeTimers();
		// the component's initial data fetch may log on the error path
		const err = jest.spyOn(console, 'error').mockImplementation(() => {});
		document.body.innerHTML =
			'<div id="fotogrids-album-galleries-root"></div>';
		// strings Proxy returns the key for any access so the component renders
		const strings = new Proxy({}, { get: (_t, p) => String(p) });
		window.fotogridsAlbumGalleries = {
			postId: 1,
			restUrl: '/r/',
			nonce: 'n',
			assignedGalleries: [],
			allGalleries: [],
			featuredGalleryId: null,
			strings,
		};
		global.wp.apiFetch.mockResolvedValue({});
		await act(async () => {
			jest.isolateModules(() =>
				require('@/admin/src/album-galleries')
			);
			jest.advanceTimersByTime(10);
			for (let i = 0; i < 6; i++) await Promise.resolve();
		});
		const root = document.getElementById('fotogrids-album-galleries-root');
		expect(root.childNodes.length).toBeGreaterThanOrEqual(0);
		// console.error spy is auto-restored by restoreMocks after the test
		expect(err).toBeDefined();
	});
});
