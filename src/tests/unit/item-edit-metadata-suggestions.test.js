/**
 * Tests for useMetadataSuggestions.
 */

import { renderHook, act } from '@testing-library/react';
import useMetadataSuggestions from '@/admin/src/components/item-edit-modal/useMetadataSuggestions';

const jsonResponse = (body) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const settle = async () => {
	await act(async () => {
		jest.advanceTimersByTime(200);
	});
	await act(async () => {
		await Promise.resolve();
	});
};

describe('useMetadataSuggestions', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		window.wpApiSettings = { root: 'http://example.test/wp-json/', nonce: 'n' };
		global.fetch = jest.fn((url) => {
			const search = new URL(url).searchParams.get('search');
			return jsonResponse([{ id: 1, name: `match:${search}` }]);
		});
	});

	afterEach(() => {
		jest.useRealTimers();
		delete global.fetch;
	});

	it('does not request anything for empty input', async () => {
		const { result } = renderHook(() => useMetadataSuggestions('tags', '  '));
		await settle();

		expect(global.fetch).not.toHaveBeenCalled();
		expect(result.current).toEqual([]);
	});

	it('sends the typed text to the server as the search term', async () => {
		const { result } = renderHook(() => useMetadataSuggestions('people', "O'Brien"));
		await settle();

		expect(global.fetch).toHaveBeenCalledTimes(1);
		const url = new URL(global.fetch.mock.calls[0][0]);
		expect(url.pathname).toBe('/wp-json/fotogrids/v1/metadata/people');
		expect(url.searchParams.get('search')).toBe("O'Brien");
		expect(result.current).toEqual([{ id: 1, name: "match:O'Brien" }]);
	});

	it('waits for typing to pause and searches only the latest text', async () => {
		const { result, rerender } = renderHook(
			({ input }) => useMetadataSuggestions('tags', input),
			{ initialProps: { input: 's' } }
		);
		rerender({ input: 'sn' });
		rerender({ input: 'snake_' });
		await settle();

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(new URL(global.fetch.mock.calls[0][0]).searchParams.get('search')).toBe('snake_');
		expect(result.current).toEqual([{ id: 1, name: 'match:snake_' }]);
	});

	it('aborts a request still in flight when the input changes', async () => {
		const { rerender } = renderHook(
			({ input }) => useMetadataSuggestions('tags', input),
			{ initialProps: { input: 'tag' } }
		);
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		const { signal } = global.fetch.mock.calls[0][1];

		rerender({ input: 'tag 4' });

		expect(signal.aborted).toBe(true);
	});

	it('clears suggestions when the input is emptied', async () => {
		const { result, rerender } = renderHook(
			({ input }) => useMetadataSuggestions('locations', input),
			{ initialProps: { input: 'beach' } }
		);
		await settle();
		expect(result.current).toHaveLength(1);

		rerender({ input: '' });

		expect(result.current).toEqual([]);
	});
});
