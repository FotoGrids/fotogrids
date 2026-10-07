/**
 * Tests that the Library header stats refetch when their refreshKey changes,
 * without dropping back to the loading state.
 */
import React from 'react';
import useLibraryStats from '@/admin/src/components/library/useLibraryStats';
import { renderElement, act } from '@tests/helpers/render-component';

const h = React.createElement;

const flush = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

let latest;
const Probe = ({ refreshKey }) => {
	latest = useLibraryStats({ entitySlug: 'tags', limit: 7, refreshKey });
	return null;
};

describe('useLibraryStats refreshKey', () => {
	let responses;

	beforeEach(() => {
		latest = null;
		responses = [
			{ items: [{ id: 1, name: 'Beach', usage_count: 3 }], total: 60 },
			{ items: [{ id: 1, name: 'Beach', usage_count: 3 }], total: 59 },
		];
		wp.apiFetch.mockReset();
		wp.apiFetch.mockImplementation(() => Promise.resolve(responses.shift()));
	});

	it('refetches and updates the total when refreshKey changes', async () => {
		const view = renderElement(h(Probe, { refreshKey: 0 }));
		await flush();
		expect(latest.total).toBe(60);
		expect(latest.loading).toBe(false);

		view.rerender(h(Probe, { refreshKey: 1 }));
		expect(latest.loading).toBe(false);
		expect(latest.total).toBe(60);

		await flush();
		expect(wp.apiFetch).toHaveBeenCalledTimes(2);
		expect(latest.total).toBe(59);
		view.unmount();
	});

	it('does not refetch when re-rendered with the same refreshKey', async () => {
		const view = renderElement(h(Probe, { refreshKey: 0 }));
		await flush();
		view.rerender(h(Probe, { refreshKey: 0 }));
		await flush();
		expect(wp.apiFetch).toHaveBeenCalledTimes(1);
		view.unmount();
	});
});
