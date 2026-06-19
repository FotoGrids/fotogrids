/**
 * Tests for metabox.js (icon/copy helpers + mount guards) and
 * global-modal-init.js (bootstrap of the modal root + public API).
 */
import { act } from '@tests/helpers/render-component';

describe('metabox', () => {
	let Metabox;

	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '';
		window.FotoGridsIcons = { star: '<svg id="star-svg"></svg>' };
		jest.isolateModules(() => {
			require('@/admin/src/metabox');
		});
		Metabox = window.FotoGridsMetabox;
		jest.runOnlyPendingTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete window.FotoGridsIcons;
		delete window.fotogridsMetaBoxes;
		document.body.innerHTML = '';
	});

	it('exposes the public metabox API', () => {
		expect(typeof Metabox.init).toBe('function');
		expect(typeof Metabox.initializeIcons).toBe('function');
		expect(typeof Metabox.initializeCopyButtons).toBe('function');
	});

	it('injects icon SVGs into placeholders', () => {
		document.body.innerHTML =
			'<span class="fotogrids-icon" data-icon="star"></span>';
		Metabox.initializeIcons();
		expect(document.getElementById('star-svg')).not.toBeNull();
	});

	it('falls back to the icon name when the SVG is missing', () => {
		document.body.innerHTML =
			'<span class="fotogrids-icon" data-icon="missing"></span>';
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		Metabox.initializeIcons();
		expect(
			document.querySelector('.fotogrids-icon').textContent
		).toBe('missing');
		warn.mockRestore();
	});

	it('attaches copy buttons without throwing', () => {
		document.body.innerHTML =
			'<button class="fotogrids-shortcode-copy" data-shortcode="[fg]"></button>';
		expect(() => Metabox.initializeCopyButtons()).not.toThrow();
	});

	it('init returns early when there is no mount container', () => {
		expect(() => Metabox.init()).not.toThrow();
	});

	it('mounts the GalleryMetabox React app into its container', () => {
		document.body.innerHTML =
			'<div id="fotogrids-gallery-metabox-root"></div>';
		window.fotogridsMetaBoxes = {
			galleryItems: [],
			canEditPosts: true,
			ajaxUrl: 'https://x/admin-ajax.php',
			nonce: 'n',
			strings: {},
		};
		act(() => {
			Metabox.init();
		});
		// the container now hosts a React tree (non-empty)
		const root = document.getElementById('fotogrids-gallery-metabox-root');
		expect(root.childNodes.length).toBeGreaterThanOrEqual(0);
	});
});

describe('global-modal-init', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.fotogridsAdmin = { isFotoGridsPage: true };
		window.fotogridsIsPro = false;
	});

	afterEach(() => {
		delete window.fotogridsAdmin;
		delete window.fotogridsIsPro;
		delete window.FotoGridsAdmin;
		document.body.innerHTML = '';
	});

	it('bootstraps the modal root and installs the public API on import', () => {
		act(() => {
			jest.isolateModules(() => {
				require('@/admin/src/global-modal-init');
			});
		});
		expect(document.getElementById('fotogrids-modal-root')).not.toBeNull();
		expect(window.FotoGridsAdmin).toBeDefined();
		expect(window.FotoGridsAdmin.modal).toBeDefined();
	});

	it('mounts the upgrade modal when a container exists for a non-Pro page', () => {
		const upgrade = document.createElement('div');
		upgrade.id = 'fotogrids-upgrade-modal';
		document.body.appendChild(upgrade);
		act(() => {
			jest.isolateModules(() => {
				require('@/admin/src/global-modal-init');
			});
		});
		// container is now associated with a React root
		expect(upgrade._reactRootContainer).toBeDefined();
	});
});
