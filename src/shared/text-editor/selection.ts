import type { Range } from './commands';

/**
 * Maps between DOM selection points and linear offsets in an editing area.
 * Text counts one per code unit, each line break counts one, and the
 * trailing sentinel break counts nothing.
 */

export const SENTINEL_CLASS = 'fotogrids-text-editor__sentinel';

function isSentinel(node: Node): boolean {
	return (
		node.nodeType === 1 &&
		(node as Element).nodeName === 'BR' &&
		(node as Element).classList.contains(SENTINEL_CLASS)
	);
}

function nodeLength(node: Node): number {
	if (node.nodeType === 3) {
		return (node as Text).data.length;
	}
	if (node.nodeType !== 1 || isSentinel(node)) {
		return 0;
	}
	if (node.nodeName === 'BR') {
		return 1;
	}
	let total = 0;
	node.childNodes.forEach((child) => {
		total += nodeLength(child);
	});
	return total;
}

/**
 * Linear offset of a DOM point inside the root.
 *
 * @param root   Editing area.
 * @param node   Point container.
 * @param offset Point offset.
 */
export function offsetOf(root: Node, node: Node, offset: number): number {
	if (!root.contains(node)) {
		return 0;
	}
	let total = 0;
	if (node.nodeType === 3) {
		total = Math.min(offset, (node as Text).data.length);
	} else {
		for (let i = 0; i < Math.min(offset, node.childNodes.length); i++) {
			total += nodeLength(node.childNodes[i]);
		}
	}
	let current: Node = node;
	while (current !== root && current.parentNode) {
		let sibling = current.previousSibling;
		while (sibling) {
			total += nodeLength(sibling);
			sibling = sibling.previousSibling;
		}
		current = current.parentNode;
	}
	return total;
}

/**
 * DOM point for a linear offset. Points prefer the end of a text node, so a
 * caret after bold text stays inside the bold run.
 *
 * @param root   Editing area.
 * @param offset Linear offset.
 */
export function pointAt(
	root: Node,
	offset: number
): { node: Node; offset: number } {
	let remaining = Math.max(0, offset);

	const walk = (parent: Node): { node: Node; offset: number } | null => {
		const children = Array.from(parent.childNodes);
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (child.nodeType === 3) {
				const length = (child as Text).data.length;
				if (remaining <= length) {
					return { node: child, offset: remaining };
				}
				remaining -= length;
			} else if (child.nodeType === 1 && !isSentinel(child)) {
				if (child.nodeName === 'BR') {
					if (remaining === 0) {
						return { node: parent, offset: i };
					}
					remaining -= 1;
					if (remaining === 0) {
						return { node: parent, offset: i + 1 };
					}
				} else {
					const found = walk(child);
					if (found) {
						return found;
					}
				}
			}
		}
		return null;
	};

	const found = walk(root);
	if (found) {
		return found;
	}
	const children = Array.from(root.childNodes);
	let end = children.length;
	while (end > 0 && isSentinel(children[end - 1])) {
		end--;
	}
	return { node: root, offset: end };
}

/**
 * Current selection inside the root as linear offsets, or null when the
 * selection is elsewhere.
 *
 * @param root Editing area.
 */
export function readSelection(
	root: HTMLElement
): (Range & { backward: boolean }) | null {
	const selection = root.ownerDocument.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return null;
	}
	const anchor = selection.anchorNode;
	const focus = selection.focusNode;
	if (!anchor || !focus || !root.contains(anchor) || !root.contains(focus)) {
		return null;
	}
	const a = offsetOf(root, anchor, selection.anchorOffset);
	const f = offsetOf(root, focus, selection.focusOffset);
	return { start: Math.min(a, f), end: Math.max(a, f), backward: f < a };
}

/**
 * Places the selection at linear offsets inside the root.
 *
 * @param root     Editing area.
 * @param range    Offsets.
 * @param backward Put the focus at the start.
 */
export function writeSelection(
	root: HTMLElement,
	range: Range,
	backward = false
): void {
	const selection = root.ownerDocument.getSelection();
	if (!selection) {
		return;
	}
	const start = pointAt(root, range.start);
	const end = pointAt(root, range.end);
	try {
		if (backward && typeof selection.setBaseAndExtent === 'function') {
			selection.setBaseAndExtent(
				end.node,
				end.offset,
				start.node,
				start.offset
			);
			return;
		}
		const domRange = root.ownerDocument.createRange();
		domRange.setStart(start.node, start.offset);
		domRange.setEnd(end.node, end.offset);
		selection.removeAllRanges();
		selection.addRange(domRange);
	} catch (e) {
		// A detached node during a re-render leaves the selection as it was.
	}
}
