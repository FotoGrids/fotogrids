/**
 * Tests for the Modal hooks and useLibraryStats. Each hook is exercised via a
 * tiny host component rendered through the shared render helper.
 */
import { useBodyScrollLock } from '@/admin/src/components/shared/Modal/hooks/useBodyScrollLock';
import {
	useModalStack,
	getTopModalId,
	getStackDepth,
} from '@/admin/src/components/shared/Modal/hooks/useModalStack';
import useLibraryStats from '@/admin/src/components/library/useLibraryStats';
import { renderElement, act } from '@tests/helpers/render-component';

const h = wp.element.createElement;

describe('useBodyScrollLock', () => {
	afterEach(() => {
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
	});

	const Host = ({ active }) => {
		useBodyScrollLock(active);
		return h('div', null, 'host');
	};

	it('locks body scroll while active and restores on unmount', () => {
		const handle = renderElement(h(Host, { active: true }));
		expect(document.body.style.overflow).toBe('hidden');
		handle.unmount();
		expect(document.body.style.overflow).toBe('');
	});

	it('does nothing when inactive', () => {
		renderElement(h(Host, { active: false }));
		expect(document.body.style.overflow).toBe('');
	});
});

describe('useModalStack', () => {
	const Host = ({ id, active }) => {
		const depth = useModalStack(id, active);
		return h('div', { 'data-depth': depth }, 'm');
	};

	it('registers on the stack while active and reports depth', () => {
		const a = renderElement(h(Host, { id: 'a', active: true }));
		expect(getStackDepth()).toBe(1);
		expect(getTopModalId()).toBe('a');
		const b = renderElement(h(Host, { id: 'b', active: true }));
		expect(getStackDepth()).toBe(2);
		expect(getTopModalId()).toBe('b');
		expect(b.container.querySelector('div').dataset.depth).toBe('1');

		b.unmount();
		expect(getStackDepth()).toBe(1);
		a.unmount();
		expect(getStackDepth()).toBe(0);
		expect(getTopModalId()).toBeNull();
	});

	it('does not register when inactive', () => {
		renderElement(h(Host, { id: 'x', active: false }));
		expect(getStackDepth()).toBe(0);
	});
});

describe('useLibraryStats', () => {
	let captured;
	const Host = (props) => {
		captured = useLibraryStats(props);
		return h('div', null, 'lib');
	};

	const flush = async () => {
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
	};

	beforeEach(() => {
		// useLibraryStats captures wp.apiFetch at module load, so configure the
		// existing setup mock rather than replacing the reference.
		global.wp.apiFetch.mockReset();
		captured = null;
	});

	it('starts loading and resolves top items + total', async () => {
		global.wp.apiFetch.mockResolvedValue({
			items: [{ id: 1, name: 'A', usage_count: 5 }],
			total: 12,
		});
		renderElement(h(Host, { entitySlug: 'tags' }));
		await flush();
		expect(captured.loading).toBe(false);
		expect(captured.topItems).toHaveLength(1);
		expect(captured.total).toBe(12);
		expect(global.wp.apiFetch).toHaveBeenCalledWith(
			expect.objectContaining({
				path: expect.stringContaining('/tags?'),
			})
		);
	});

	it('does not fetch without an entitySlug', async () => {
		renderElement(h(Host, { entitySlug: '' }));
		await flush();
		expect(global.wp.apiFetch).not.toHaveBeenCalled();
	});

	it('stops loading on a request failure', async () => {
		global.wp.apiFetch.mockRejectedValue(new Error('boom'));
		renderElement(h(Host, { entitySlug: 'people' }));
		await flush();
		expect(captured.loading).toBe(false);
		expect(captured.topItems).toEqual([]);
	});
});
