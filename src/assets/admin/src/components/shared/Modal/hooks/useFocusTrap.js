import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root) => {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
};

/**
 * Trap keyboard focus inside `containerRef` while `active` is true.
 * Restores focus to the element that was focused before activation when
 * `active` becomes false or the component unmounts.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {boolean} active
 * @param {React.RefObject<HTMLElement>|null} initialFocusRef Optional first
 *   element to focus on activation. Defaults to the first focusable child.
 */
export const useFocusTrap = (containerRef, active, initialFocusRef = null) => {
    const previouslyFocused = useRef(null);

    useEffect(() => {
        if (!active || !containerRef.current) return undefined;

        previouslyFocused.current = document.activeElement;

        const target = initialFocusRef?.current
            ?? getFocusable(containerRef.current)[0]
            ?? containerRef.current;

        target?.focus();

        const handleKeyDown = (event) => {
            if (event.key !== 'Tab') return;
            const focusables = getFocusable(containerRef.current);
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement;

            if (event.shiftKey && current === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && current === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            const toRestore = previouslyFocused.current;
            if (toRestore && typeof toRestore.focus === 'function') {
                toRestore.focus();
            }
        };
    }, [active, containerRef, initialFocusRef]);
};
