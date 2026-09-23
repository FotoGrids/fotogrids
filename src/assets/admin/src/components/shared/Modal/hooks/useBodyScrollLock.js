import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow = '';
let originalPaddingInlineEnd = '';

export const useBodyScrollLock = (active) => {
	useEffect(() => {
		if (!active) return undefined;

		if (lockCount === 0) {
			const body = document.body;
			originalOverflow = body.style.overflow;
			originalPaddingInlineEnd = body.style.paddingInlineEnd;

			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			if (scrollbarWidth > 0) {
				body.style.paddingInlineEnd = `${scrollbarWidth}px`;
			}
			body.style.overflow = 'hidden';
		}
		lockCount += 1;

		return () => {
			lockCount = Math.max(0, lockCount - 1);
			if (lockCount === 0) {
				document.body.style.overflow = originalOverflow;
				document.body.style.paddingInlineEnd = originalPaddingInlineEnd;
			}
		};
	}, [active]);
};
