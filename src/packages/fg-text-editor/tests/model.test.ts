import { bundledProfile, validateProfile } from '../../fg-formatted-text';
import {
	clearFormatting,
	hasMark,
	insertBreak,
	linkAt,
	removeLink,
	replaceRange,
	setLink,
	textUnits,
	toggleMark,
} from '../commands';
import { History } from '../history';
import {
	completeHref,
	initialChoice,
	isAllowedHref,
	linkAttributes,
} from '../link';
import { docText, load, read, serialize, type Doc } from '../model';

const profile = bundledProfile();

const doc = (value: string): Doc => load(value, profile).doc;
const out = (value: Doc): string => serialize(value, profile);

describe('model', () => {
	it.each([
		['plain', 'Harbour at dawn'],
		['bold', 'A <strong>bold</strong> word'],
		['b and i keep their names', '<b>b</b> and <i>i</i>'],
		['nested marks', '<strong><em>both</em></strong>'],
		['link', 'See <a href="https://example.com">the pier</a>'],
		[
			'link with choices',
			'<a href="https://example.com" target="_self" rel="">x</a>',
		],
		['line breaks', 'one\ntwo\n\nthree'],
		['entities', 'Fish &amp; chips &lt;3'],
	])('round-trips %s', (_name, value) => {
		const loaded = load(value, profile);
		expect(loaded.unsupported).toBe(false);
		expect(out(loaded.doc)).toBe(value);
	});

	it('nests marks consistently, links outermost', () => {
		expect(out(doc('<em><strong>x</strong></em>'))).toBe(
			'<strong><em>x</em></strong>'
		);
		expect(out(doc('<strong><a href="/a">x</a></strong>'))).toBe(
			'<a href="/a"><strong>x</strong></a>'
		);
	});

	it('keeps a mark open across a line break inside it', () => {
		expect(out(doc('<strong>a\nb</strong>'))).toBe('<strong>a\nb</strong>');
	});

	it.each([
		['an unknown element', 'a <span class="x">b</span>'],
		['a paragraph', '<p>a</p><p>b</p>'],
		['a dropped attribute', '<a href="/x" class="y">x</a>'],
		['an unsafe link', '<a href="javascript:alert(1)">x</a>'],
		['an image', 'a <img src="x.jpg"> b'],
	])('flags %s as unsupported', (_name, value) => {
		expect(load(value, profile).unsupported).toBe(true);
	});

	it('flags elements a widened profile allows but the editor cannot show', () => {
		const wide = validateProfile({
			...profile,
			elements: {
				...profile.elements,
				img: { attributes: { src: { type: 'url' } } },
			},
		});
		expect(load('a <img src="/x.jpg"> b', wide).unsupported).toBe(true);
	});

	it('reads editing markup without trimming what the user typed', () => {
		const typed = read('a <b>b</b> <br><br>', profile);
		expect(docText(typed)).toBe('a b \n\n');
	});

	it('reads browser markup into allowed marks only', () => {
		const typed = read(
			'<span style="font-weight:bold">x</span><div>y</div><font color="red">z</font>',
			profile
		);
		expect(docText(typed)).toBe('x\ny\nz');
		expect(out(typed)).toBe('x\ny\nz');
	});

	it('stores the tidy form', () => {
		expect(out(read(' a  \n\n\n\nb ', profile))).toBe('a\n\nb');
	});
});

describe('commands', () => {
	it('toggles bold on and off over a range', () => {
		const on = toggleMark(
			doc('Harbour at dawn'),
			{ start: 0, end: 7 },
			['strong', 'b'],
			profile
		);
		expect(out(on.doc)).toBe('<strong>Harbour</strong> at dawn');
		expect(hasMark(on.doc, { start: 0, end: 7 }, ['strong', 'b'])).toBe(
			true
		);
		const off = toggleMark(
			on.doc,
			{ start: 0, end: 7 },
			['strong', 'b'],
			profile
		);
		expect(out(off.doc)).toBe('Harbour at dawn');
	});

	it('treats b as bold when toggling', () => {
		const off = toggleMark(
			doc('<b>x</b>'),
			{ start: 0, end: 1 },
			['strong', 'b'],
			profile
		);
		expect(out(off.doc)).toBe('x');
	});

	it('adds the mark where part of a range lacks it', () => {
		const result = toggleMark(
			doc('<em>ab</em>cd'),
			{ start: 0, end: 4 },
			['em', 'i'],
			profile
		);
		expect(out(result.doc)).toBe('<em>abcd</em>');
	});

	it('accepts a backward range', () => {
		const result = toggleMark(
			doc('abcd'),
			{ start: 3, end: 1 },
			['em'],
			profile
		);
		expect(out(result.doc)).toBe('a<em>bc</em>d');
		expect(result.selection).toEqual({ start: 1, end: 3 });
	});

	it('inserts a line break and keeps the surrounding mark', () => {
		const result = insertBreak(
			doc('<strong>ab</strong>'),
			{ start: 1, end: 1 },
			profile
		);
		expect(out(result.doc)).toBe('<strong>a\nb</strong>');
		expect(result.selection).toEqual({ start: 2, end: 2 });
	});

	it('replaces a selection with a line break', () => {
		const result = insertBreak(doc('abcd'), { start: 1, end: 3 }, profile);
		expect(out(result.doc)).toBe('a\nd');
	});

	it('clears formatting but keeps line breaks', () => {
		const result = clearFormatting(
			doc('<strong>a</strong>\n<a href="/x"><em>b</em></a>'),
			{ start: 0, end: 3 },
			profile
		);
		expect(out(result.doc)).toBe('a\nb');
	});

	it('links a selection and edits the link at the caret', () => {
		const linked = setLink(
			doc('see the pier'),
			{ start: 4, end: 12 },
			[['href', 'https://a.test']],
			profile
		);
		expect(out(linked.doc)).toBe(
			'see <a href="https://a.test">the pier</a>'
		);

		const found = linkAt(linked.doc, { start: 6, end: 6 });
		expect(found).toMatchObject({ start: 4, end: 12 });

		const edited = setLink(
			linked.doc,
			{ start: 6, end: 6 },
			[
				['href', 'https://b.test'],
				['target', '_self'],
			],
			profile
		);
		expect(out(edited.doc)).toBe(
			'see <a href="https://b.test" target="_self">the pier</a>'
		);
	});

	it('inserts the address as text for a link with no selection', () => {
		const result = setLink(
			doc('Go now'),
			{ start: 3, end: 3 },
			[['href', 'https://a.test']],
			profile
		);
		expect(out(result.doc)).toBe(
			'Go <a href="https://a.test">https://a.test</a>now'
		);
		expect(result.selection).toEqual({ start: 3, end: 17 });
	});

	it('removes the whole link around the caret', () => {
		const result = removeLink(
			doc('a <a href="/x">bc</a> d'),
			{ start: 3, end: 3 },
			profile
		);
		expect(out(result.doc)).toBe('a bc d');
	});

	it('replaces a range with text', () => {
		const result = replaceRange(
			doc('abcd'),
			{ start: 1, end: 3 },
			textUnits('X\nY'),
			profile
		);
		expect(out(result.doc)).toBe('aX\nYd');
		expect(result.selection).toEqual({ start: 4, end: 4 });
	});
});

describe('history', () => {
	it('groups typing within the delay and limits its steps', () => {
		let now = 0;
		const history = new History({ now: () => now, limit: 2 });
		const snap = (text: string) => ({
			doc: doc(text),
			selection: { start: 0, end: 0 },
		});

		history.record(snap('a'), 'typing');
		now = 100;
		history.record(snap('ab'), 'typing');
		expect(docText(history.undo(snap('abc'))!.doc)).toBe('a');
		expect(history.canUndo()).toBe(false);
		expect(docText(history.redo(snap('a'))!.doc)).toBe('abc');

		now = 2000;
		history.record(snap('1'));
		history.record(snap('2'));
		history.record(snap('3'));
		expect(docText(history.undo(snap('4'))!.doc)).toBe('3');
		expect(docText(history.undo(snap('3'))!.doc)).toBe('2');
		expect(history.undo(snap('2'))).toBeNull();
	});

	it('drops the redo stack after a new change', () => {
		const history = new History();
		const snap = (text: string) => ({
			doc: doc(text),
			selection: { start: 0, end: 0 },
		});
		history.record(snap('a'));
		history.undo(snap('b'));
		history.record(snap('a'));
		expect(history.canRedo()).toBe(false);
	});
});

describe('link choices', () => {
	it.each([
		['example.com', 'https://example.com'],
		['www.example.com/path', 'https://www.example.com/path'],
		['me@example.com', 'mailto:me@example.com'],
		['https://example.com', 'https://example.com'],
		['/gallery', '/gallery'],
		['#top', '#top'],
		['tel:+15551234', 'tel:+15551234'],
	])('completes %s', (input, expected) => {
		expect(completeHref(input)).toBe(expected);
	});

	it('accepts only addresses the profile allows', () => {
		expect(isAllowedHref('https://example.com/?a=1&b=2', profile)).toBe(
			true
		);
		expect(isAllowedHref('javascript:alert(1)', profile)).toBe(false);
		expect(isAllowedHref('data:text/html,x', profile)).toBe(false);
		expect(isAllowedHref('https://exa mple.com', profile)).toBe(false);
		expect(isAllowedHref('', profile)).toBe(false);
	});

	it('shows site defaults for a link without choices of its own', () => {
		expect(
			initialChoice([['href', '/x']], { newTab: true, nofollow: true })
		).toMatchObject({
			newTab: true,
			nofollow: true,
		});
		expect(
			initialChoice(
				[
					['href', '/x'],
					['target', '_self'],
					['rel', ''],
				],
				{ newTab: true, nofollow: true }
			)
		).toMatchObject({ newTab: false, nofollow: false });
	});

	it('writes target and rel only for choices the user changed', () => {
		const untouched = linkAttributes(
			{
				href: '/x',
				newTab: true,
				nofollow: true,
				newTabTouched: false,
				nofollowTouched: false,
			},
			[],
			profile
		);
		expect(untouched).toEqual([['href', '/x']]);

		const follow = linkAttributes(
			{
				href: '/x',
				newTab: true,
				nofollow: false,
				newTabTouched: true,
				nofollowTouched: true,
			},
			[
				['href', '/old'],
				['rel', 'nofollow sponsored'],
			],
			profile
		);
		expect(follow).toEqual([
			['href', '/x'],
			['target', '_blank'],
			['rel', 'sponsored'],
		]);
	});
});
