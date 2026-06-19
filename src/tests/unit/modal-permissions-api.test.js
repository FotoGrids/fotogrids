/**
 * Tests for installPublicApi (Modal) and installPermissionsApi.
 */
import { installPublicApi } from '@/admin/src/components/shared/Modal/api/publicApi';
import { installPermissionsApi } from '@/admin/src/components/shared/installPermissionsApi';
import { modalRegistry } from '@/admin/src/components/shared/Modal/api/modalRegistry';

const lastEntry = () => modalRegistry.list().at(-1);

describe('installPublicApi', () => {
	afterEach(() => {
		delete window.FotoGridsAdmin;
	});

	it('installs the modal API on window.FotoGridsAdmin', () => {
		installPublicApi();
		const api = window.FotoGridsAdmin.modal;
		expect(api).toBeDefined();
		expect(typeof api.open).toBe('function');
		expect(typeof api.close).toBe('function');
		expect(typeof api.closeAll).toBe('function');
		expect(typeof api.confirm).toBe('function');
		expect(typeof api.on).toBe('function');
	});

	it('is idempotent (does not replace an existing API)', () => {
		installPublicApi();
		const first = window.FotoGridsAdmin.modal;
		installPublicApi();
		expect(window.FotoGridsAdmin.modal).toBe(first);
	});

	it('exposes variant + hook surfaces', () => {
		installPublicApi();
		const api = window.FotoGridsAdmin.modal;
		expect(typeof api.danger).toBe('function');
		expect(typeof api.success).toBe('function');
		expect(api.hooks).toBeDefined();
	});

	describe('promise wrappers (exercise wrapConfirm/Prompt/Alert)', () => {
		let api;
		beforeEach(() => {
			modalRegistry.closeAll();
			installPublicApi();
			api = window.FotoGridsAdmin.modal;
		});

		it('open/close/closeAll proxy the registry', () => {
			api.open({ id: 'p' });
			expect(modalRegistry.list().some((e) => e.id === 'p')).toBe(true);
			api.close('p');
			expect(modalRegistry.list().some((e) => e.id === 'p')).toBe(false);
			api.open({ id: 'a' });
			api.closeAll();
			expect(modalRegistry.list()).toHaveLength(0);
		});

		it('confirm resolves true on confirm and runs opts.onConfirm', async () => {
			const onConfirm = jest.fn();
			const p = api.confirm({ onConfirm });
			await lastEntry().options.onConfirm();
			await expect(p).resolves.toBe(true);
			expect(onConfirm).toHaveBeenCalled();
		});

		it('warning/danger resolve false when dismissed', async () => {
			const pw = api.warning({});
			lastEntry().options.onClose('overlay');
			await expect(pw).resolves.toBe(false);

			const pd = api.danger({});
			lastEntry().options.onClose('esc');
			await expect(pd).resolves.toBe(false);
		});

		it('prompt resolves the value and runs opts.onSubmit', async () => {
			const onSubmit = jest.fn();
			const p = api.prompt({ onSubmit });
			await lastEntry().options.onSubmit('hi');
			await expect(p).resolves.toBe('hi');
			expect(onSubmit).toHaveBeenCalledWith('hi');
		});

		it('prompt resolves null when dismissed', async () => {
			const p = api.prompt({});
			lastEntry().options.onClose('overlay');
			await expect(p).resolves.toBeNull();
		});

		it('alert/info/success resolve on close', async () => {
			const pa = api.alert({});
			lastEntry().options.onClose('close-button');
			await expect(pa).resolves.toBeUndefined();

			const pi = api.info({});
			lastEntry().options.onClose('esc');
			await expect(pi).resolves.toBeUndefined();

			const ps = api.success({});
			lastEntry().options.onClose('confirm');
			await expect(ps).resolves.toBeUndefined();
		});

		it('wrappers work with no opts (no optional handlers)', async () => {
			const pc = api.confirm();
			await lastEntry().options.onConfirm();
			await expect(pc).resolves.toBe(true);

			const pp = api.prompt();
			lastEntry().options.onClose('overlay');
			await expect(pp).resolves.toBeNull();

			const pa = api.alert();
			lastEntry().options.onClose('esc');
			await expect(pa).resolves.toBeUndefined();
		});

		it('confirm onClose("confirm") path does not resolve false', async () => {
			const p = api.confirm({});
			const entry = lastEntry();
			entry.options.onClose('confirm');
			await entry.options.onConfirm();
			await expect(p).resolves.toBe(true);
		});

		it('on/emit/off round-trip through document events', () => {
			const handler = jest.fn();
			api.on('opened', handler);
			api.emit('opened', { id: 'z' });
			expect(handler).toHaveBeenCalled();
			api.off('opened', handler);
			handler.mockClear();
			api.emit('opened', {});
			expect(handler).not.toHaveBeenCalled();
		});
	});
});

describe('installPermissionsApi', () => {
	afterEach(() => {
		delete window.FotoGridsAdmin;
	});

	it('installs the permissions API namespace', () => {
		installPermissionsApi();
		const api = window.FotoGridsAdmin.permissions;
		expect(api).toBeDefined();
		expect(typeof api.registerMatrixOverride).toBe('function');
		expect(typeof api.getRegistry).toBe('function');
		expect(typeof api.on).toBe('function');
	});

	it('is idempotent', () => {
		installPermissionsApi();
		const first = window.FotoGridsAdmin.permissions;
		installPermissionsApi();
		expect(window.FotoGridsAdmin.permissions).toBe(first);
	});

	it('getRegistry returns null before any load', () => {
		installPermissionsApi();
		expect(window.FotoGridsAdmin.permissions.getRegistry()).toBeNull();
	});

	it('registerMatrixOverride stores a component and fires an override event', () => {
		installPermissionsApi();
		const Comp = () => null;
		const handler = jest.fn();
		document.addEventListener(
			'fotogrids:admin:permissions:override',
			handler
		);
		window.FotoGridsAdmin.permissions.registerMatrixOverride(Comp);
		expect(handler).toHaveBeenCalled();
		expect(handler.mock.calls[0][0].detail).toMatchObject({
			panel: 'matrix',
			component: Comp,
		});
		document.removeEventListener(
			'fotogrids:admin:permissions:override',
			handler
		);
	});

	it('registerMatrixOverride(null) clears the override', () => {
		installPermissionsApi();
		expect(() =>
			window.FotoGridsAdmin.permissions.registerMatrixOverride()
		).not.toThrow();
	});

	it('registerPanelOverride handles the simple panel and ignores others', () => {
		installPermissionsApi();
		const handler = jest.fn();
		document.addEventListener(
			'fotogrids:admin:permissions:override',
			handler
		);
		const Comp = () => null;
		window.FotoGridsAdmin.permissions.registerPanelOverride('simple', Comp);
		expect(handler).toHaveBeenCalledTimes(1);
		// an unknown panel name is a no-op (no event)
		window.FotoGridsAdmin.permissions.registerPanelOverride('mystery', Comp);
		expect(handler).toHaveBeenCalledTimes(1);
		document.removeEventListener(
			'fotogrids:admin:permissions:override',
			handler
		);
	});

	it('on/off subscribe and unsubscribe permission events', () => {
		installPermissionsApi();
		const api = window.FotoGridsAdmin.permissions;
		const handler = jest.fn();
		api.on('registry-loaded', handler);
		document.dispatchEvent(
			new CustomEvent('fotogrids:admin:permissions:registry-loaded', {
				detail: {},
			})
		);
		expect(handler).toHaveBeenCalledTimes(1);
		api.off('registry-loaded', handler);
		document.dispatchEvent(
			new CustomEvent('fotogrids:admin:permissions:registry-loaded', {
				detail: {},
			})
		);
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
