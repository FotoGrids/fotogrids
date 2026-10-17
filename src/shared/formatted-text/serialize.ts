import { escapeAttribute, escapeText } from './entities';
import {
	SCREEN_READER_CLASS,
	VOID_ELEMENTS,
	type FormatNode,
} from './document';

/**
 * Serializes nodes to an HTML string.
 *
 * @param nodes    Parsed nodes.
 * @param newlines Write line breaks as "\n" instead of `<br>`.
 */
export function nodesToHtml(nodes: FormatNode[], newlines = false): string {
	let out = '';
	for (const node of nodes) {
		if (node.kind === 'text') {
			out += escapeText(node.value);
		} else if (node.kind === 'break') {
			out += newlines ? '\n' : '<br>';
		} else {
			out += '<' + node.name;
			for (const [name, value] of node.attributes) {
				out += ' ' + name + '="' + escapeAttribute(value) + '"';
			}
			out += '>';
			if (!VOID_ELEMENTS.includes(node.name)) {
				out +=
					nodesToHtml(node.children, newlines) +
					'</' +
					node.name +
					'>';
			}
		}
	}
	return out;
}

/**
 * Serializes nodes to plain text, with "\n" for line breaks.
 *
 * @param nodes Parsed nodes.
 */
export function nodesToText(nodes: FormatNode[]): string {
	let out = '';
	for (const node of nodes) {
		if (node.kind === 'text') {
			out += node.value;
		} else if (node.kind === 'break') {
			out += '\n';
		} else if (
			!node.attributes.some(
				([name, value]) =>
					name === 'class' && value === SCREEN_READER_CLASS
			)
		) {
			out += nodesToText(node.children);
		}
	}
	return out;
}

/**
 * Builds DOM nodes for parsed nodes in the given document.
 *
 * @param nodes    Parsed nodes.
 * @param document Owner document of the target element.
 */
export function nodesToFragment(
	nodes: FormatNode[],
	document: Document
): DocumentFragment {
	const fragment = document.createDocumentFragment();
	const append = (parent: Node, list: FormatNode[]): void => {
		for (const node of list) {
			if (node.kind === 'text') {
				parent.appendChild(document.createTextNode(node.value));
			} else if (node.kind === 'break') {
				parent.appendChild(document.createElement('br'));
			} else {
				const element = document.createElement(node.name);
				for (const [name, value] of node.attributes) {
					element.setAttribute(name, value);
				}
				if (!VOID_ELEMENTS.includes(node.name)) {
					append(element, node.children);
				}
				parent.appendChild(element);
			}
		}
	};
	append(fragment, nodes);
	return fragment;
}
