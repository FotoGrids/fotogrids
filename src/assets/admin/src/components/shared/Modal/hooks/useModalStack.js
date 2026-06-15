import { useEffect, useState } from 'react';

const subscribers = new Set();
const stack = [];

const notify = () => {
	subscribers.forEach(cb => cb([...stack]));
};

const push = id => {
	stack.push(id);
	notify();
};

const remove = id => {
	const idx = stack.indexOf(id);
	if (idx !== -1) {
		stack.splice(idx, 1);
		notify();
	}
};

export const getTopModalId = () =>
	stack.length ? stack[stack.length - 1] : null;

export const getStackDepth = () => stack.length;

/**
 * Register a modal instance on the global stack while `active` is true.
 * Returns the modal's depth position (0-indexed) for z-index ramping.
 */
export const useModalStack = (id, active) => {
	const [depth, setDepth] = useState(0);

	useEffect(() => {
		if (!active) return undefined;

		push(id);

		const updateDepth = snapshot => {
			const idx = snapshot.indexOf(id);
			setDepth(idx === -1 ? 0 : idx);
		};
		subscribers.add(updateDepth);
		updateDepth(stack);

		return () => {
			subscribers.delete(updateDepth);
			remove(id);
		};
	}, [id, active]);

	return depth;
};
