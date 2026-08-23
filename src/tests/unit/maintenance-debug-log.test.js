/**
 * Tests for the Debug Log panel in
 * src/assets/admin/src/components/plugin-settings/tabs/MaintenanceTab.jsx
 */
import React, { act } from 'react';
import apiFetch from '@wordpress/api-fetch';
import MaintenanceTab from '@/admin/src/components/plugin-settings/tabs/MaintenanceTab';
import { renderElement } from '@tests/helpers/render-component';

jest.mock('@wordpress/api-fetch');

const channel = (overrides = {}) => ({
	slug: 'catalog',
	label: 'Catalog',
	description: 'Logs catalog assembly steps.',
	enabled: false,
	forced_by_constant: false,
	forced_value: false,
	constant_name: 'FOTOGRIDS_DEBUG_CATALOG',
	...overrides,
});

const payload = (overrides = {}) => ({
	wp_debug: true,
	wp_debug_log: true,
	channels: [channel()],
	notice_title: '',
	notice: '',
	note: 'Each channel can also be locked from your wp-config.php file.',
	...overrides,
});

const lights = (container) =>
	Array.from(container.querySelectorAll('.fotogrids-status-light')).map(
		(el) => ({
			label: el.querySelector('.fotogrids-status-light__label')
				.textContent,
			state: el.querySelector('.fotogrids-status-light__state')
				.textContent,
			on: el.classList.contains('fotogrids-status-light--on'),
			off: el.classList.contains('fotogrids-status-light--off'),
			muted: el.classList.contains('fotogrids-status-light--muted'),
		})
	);

const mount = async (data) => {
	apiFetch.mockResolvedValue(data);
	let handle;
	await act(async () => {
		handle = renderElement(React.createElement(MaintenanceTab));
	});
	return handle;
};

describe('MaintenanceTab Debug Log panel', () => {
	it('shows both lights green when WP_DEBUG and WP_DEBUG_LOG are on', async () => {
		const { container, unmount } = await mount(payload());

		expect(lights(container)).toEqual([
			{
				label: 'WP_DEBUG',
				state: 'On',
				on: true,
				off: false,
				muted: false,
			},
			{
				label: 'WP_DEBUG_LOG',
				state: 'On',
				on: true,
				off: false,
				muted: false,
			},
		]);
		expect(
			container.querySelector('.fotogrids-info-block__title').textContent
		).toBe('Note');
		expect(container.querySelector('[role="switch"]').disabled).toBe(false);

		unmount();
	});

	it('reds the WP_DEBUG_LOG light and surfaces the notice when only the log file is off', async () => {
		const { container, unmount } = await mount(
			payload({
				wp_debug_log: false,
				notice_title: 'Lines are not being saved to a file',
				notice: 'Add define to wp-config.php.',
			})
		);

		expect(lights(container)[1]).toMatchObject({ state: 'Off', off: true });
		expect(
			Array.from(
				container.querySelectorAll('.fotogrids-info-block__title')
			).map((el) => el.textContent)
		).toEqual(['Lines are not being saved to a file', 'Note']);

		unmount();
	});

	it('disables the toggles and mutes the log light when WP_DEBUG is off', async () => {
		const { container, unmount } = await mount(
			payload({
				wp_debug: false,
				wp_debug_log: false,
				notice_title: 'Logging is switched off',
				notice: 'Add define to wp-config.php.',
			})
		);

		expect(lights(container)).toEqual([
			{
				label: 'WP_DEBUG',
				state: 'Off',
				on: false,
				off: true,
				muted: false,
			},
			{
				label: 'WP_DEBUG_LOG',
				state: 'Not used',
				on: false,
				off: false,
				muted: true,
			},
		]);
		expect(container.querySelector('[role="switch"]').disabled).toBe(true);

		unmount();
	});

	it('prints the constant under every channel and locks rows overridden by one', async () => {
		const { container, unmount } = await mount(
			payload({
				channels: [
					channel(),
					channel({
						slug: 'render',
						label: 'Render',
						description: 'Logs frontend render decisions.',
						forced_by_constant: true,
						forced_value: true,
						constant_name: 'FOTOGRIDS_DEBUG_RENDER',
					}),
				],
			})
		);

		const constants = Array.from(
			container.querySelectorAll('.fotogrids-debug-channel__constant')
		).map((el) => el.textContent);
		expect(constants).toHaveLength(2);
		expect(constants[0]).toBe('FOTOGRIDS_DEBUG_CATALOG');

		const toggles = container.querySelectorAll('[role="switch"]');
		expect(toggles[0].disabled).toBe(false);
		expect(toggles[1].disabled).toBe(true);
		expect(toggles[1].getAttribute('aria-checked')).toBe('true');

		unmount();
	});
});
