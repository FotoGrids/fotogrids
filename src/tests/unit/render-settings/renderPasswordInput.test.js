/**
 * Tests for renderPasswordInput.js
 */
import '@/admin/plain/render-settings/renderPasswordInput';
import { renderElement, click, changeValue, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const renderIcon = (n) => n;
const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const build = (deps = {}) =>
	window.FotoGridsRenderSettings.renderPasswordInput(
		{ key: 'pw', label: 'Password', placeholder: 'Enter' },
		'',
		false,
		{
			updateSetting: jest.fn(),
			renderIcon,
			__,
			postId: 3,
			restUrl: 'https://x/wp-json/fotogrids/v1/',
			restNonce: 'n',
			passwordIsSet: false,
			...deps,
		}
	);

describe('renderPasswordInput', () => {
	it('renders a masked input by default', () => {
		const { container } = renderElement(build());
		const input = container.querySelector('input');
		expect(input.type).toBe('password');
		expect(input.placeholder).toBe('Enter');
	});

	it('toggles visibility locally when no password is saved', () => {
		const { container } = renderElement(build());
		click(container.querySelector('.fotogrids-password-input__toggle'));
		expect(container.querySelector('input').type).toBe('text');
	});

	it('calls updateSetting as the user types', () => {
		const updateSetting = jest.fn();
		const { container } = renderElement(build({ updateSetting }));
		changeValue(container.querySelector('input'), 'secret');
		expect(updateSetting).toHaveBeenCalledWith('pw', 'secret');
	});

	it('shows a fixed-width dot mask placeholder when a password exists', () => {
		const { container } = renderElement(build({ passwordIsSet: true }));
		expect(container.querySelector('input').placeholder).toBe('••••••••');
	});

	it('fetches and reveals a saved password on eye click', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ password: 'hunter2' }),
			})
		);
		const handle = renderElement(build({ passwordIsSet: true }));
		await act(async () => {
			click(
				handle.container.querySelector(
					'.fotogrids-password-input__toggle'
				)
			);
			await Promise.resolve();
			await Promise.resolve();
		});
		await flush();
		const input = handle.container.querySelector('input');
		expect(input.type).toBe('text');
		expect(input.value).toBe('hunter2');
	});

	it('shows a permission-denied message on 403', async () => {
		global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 403 }));
		const handle = renderElement(build({ passwordIsSet: true }));
		await act(async () => {
			click(
				handle.container.querySelector(
					'.fotogrids-password-input__toggle'
				)
			);
			await Promise.resolve();
			await Promise.resolve();
		});
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-password-input__denied')
				.textContent
		).toMatch(/permission/i);
	});

	it('shows an error message on a non-403 failure', async () => {
		global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));
		const handle = renderElement(build({ passwordIsSet: true }));
		await act(async () => {
			click(
				handle.container.querySelector(
					'.fotogrids-password-input__toggle'
				)
			);
			await Promise.resolve();
			await Promise.resolve();
		});
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-password-input__denied')
				.textContent
		).toMatch(/Could not retrieve/i);
	});

	it('shows a Locked badge from field state', () => {
		const { container } = renderElement(
			build({ getFieldState: () => 'locked' })
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});
