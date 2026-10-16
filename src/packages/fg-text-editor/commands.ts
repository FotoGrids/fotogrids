import type { Profile } from '../fg-formatted-text';
import {
	fromUnits,
	sameMark,
	toUnits,
	type Attributes,
	type Doc,
	type Mark,
	type Unit,
} from './model';

/**
 * Pure editing commands. Each takes a document and a range of offsets and
 * returns the new document and selection.
 */

export interface Range {
	start: number;
	end: number;
}

export interface EditResult {
	doc: Doc;
	selection: Range;
}

export interface LinkRange extends Range {
	mark: Mark;
}

function ordered(range: Range): Range {
	return range.start <= range.end
		? { start: range.start, end: range.end }
		: { start: range.end, end: range.start };
}

function clamp(range: Range, length: number): Range {
	const { start, end } = ordered(range);
	return {
		start: Math.max(0, Math.min(start, length)),
		end: Math.max(0, Math.min(end, length)),
	};
}

/**
 * Marks that apply at a caret: those of the unit before it, or of the first
 * unit at the very start.
 *
 * @param doc    Document.
 * @param offset Caret offset.
 */
export function marksAt(doc: Doc, offset: number): Mark[] {
	const units = toUnits(doc);
	if (units.length === 0) {
		return [];
	}
	const unit =
		offset > 0 ? units[Math.min(offset, units.length) - 1] : units[0];
	return unit.marks.filter((mark) => mark.name !== 'a');
}

/**
 * Whether every unit in a range carries one of the given mark names. A
 * collapsed range checks the marks at the caret.
 *
 * @param doc   Document.
 * @param range Selection.
 * @param names Equivalent element names, e.g. ['strong', 'b'].
 */
export function hasMark(doc: Doc, range: Range, names: string[]): boolean {
	const units = toUnits(doc);
	const { start, end } = clamp(range, units.length);
	if (start === end) {
		const unit = start > 0 ? units[start - 1] : units[0];
		return !!unit && unit.marks.some((mark) => names.includes(mark.name));
	}
	const slice = units.slice(start, end).filter((unit) => unit.char !== null);
	return (
		slice.length > 0 &&
		slice.every((unit) =>
			unit.marks.some((mark) => names.includes(mark.name))
		)
	);
}

/**
 * Adds a mark to a range, or removes it when the whole range has it.
 *
 * @param doc     Document.
 * @param range   Selection; collapsed ranges are returned unchanged.
 * @param names   Equivalent element names; the first is the one added.
 * @param profile Effective profile.
 */
export function toggleMark(
	doc: Doc,
	range: Range,
	names: string[],
	profile: Profile
): EditResult {
	const units = toUnits(doc);
	const selection = clamp(range, units.length);
	if (selection.start === selection.end) {
		return { doc, selection };
	}
	const remove = hasMark(doc, selection, names);
	const next = units.map((unit, index) => {
		if (index < selection.start || index >= selection.end) {
			return unit;
		}
		const kept = unit.marks.filter((mark) => !names.includes(mark.name));
		return {
			...unit,
			marks: remove
				? kept
				: [...kept, { name: names[0], attributes: [] }],
		};
	});
	return { doc: fromUnits(next, profile), selection };
}

/**
 * Inserts content in place of a range.
 *
 * @param doc      Document.
 * @param range    Range to replace.
 * @param inserted Units to insert.
 * @param profile  Effective profile.
 */
export function replaceRange(
	doc: Doc,
	range: Range,
	inserted: Unit[],
	profile: Profile
): EditResult {
	const units = toUnits(doc);
	const { start, end } = clamp(range, units.length);
	const next = [...units.slice(0, start), ...inserted, ...units.slice(end)];
	const caret = start + inserted.length;
	return {
		doc: fromUnits(next, profile),
		selection: { start: caret, end: caret },
	};
}

/**
 * Units for plain text, with "\n" as line breaks.
 *
 * @param text  Text to insert.
 * @param marks Marks for every unit.
 */
export function textUnits(text: string, marks: Mark[] = []): Unit[] {
	const units: Unit[] = [];
	const clean = text.replace(/\r\n?/g, '\n');
	for (let i = 0; i < clean.length; i++) {
		units.push({ char: clean[i] === '\n' ? null : clean[i], marks });
	}
	return units;
}

/**
 * Inserts a line break, keeping the marks around the caret.
 *
 * @param doc     Document.
 * @param range   Selection.
 * @param profile Effective profile.
 */
export function insertBreak(
	doc: Doc,
	range: Range,
	profile: Profile
): EditResult {
	const { start } = ordered(range);
	const units = toUnits(doc);
	const before =
		start > 0 ? units[Math.min(start, units.length) - 1] : undefined;
	const after = units[start];
	const marks =
		before && after
			? before.marks.filter((mark) =>
					after.marks.some((other) => sameMark(mark, other))
				)
			: [];
	return replaceRange(doc, range, [{ char: null, marks }], profile);
}

/**
 * Removes every mark from a range. Line breaks stay.
 *
 * @param doc     Document.
 * @param range   Selection.
 * @param profile Effective profile.
 */
export function clearFormatting(
	doc: Doc,
	range: Range,
	profile: Profile
): EditResult {
	const units = toUnits(doc);
	const selection = clamp(range, units.length);
	const next = units.map((unit, index) =>
		index >= selection.start && index < selection.end
			? { ...unit, marks: [] }
			: unit
	);
	return { doc: fromUnits(next, profile), selection };
}

/**
 * The link around an offset or covering a range, if any.
 *
 * @param doc   Document.
 * @param range Selection.
 */
export function linkAt(doc: Doc, range: Range): LinkRange | null {
	const units = toUnits(doc);
	const { start, end } = clamp(range, units.length);
	const probe =
		start === end ? (start < units.length ? start : start - 1) : start;
	const pick = (index: number): Mark | undefined =>
		units[index]?.marks.find((mark) => mark.name === 'a');

	let mark = pick(probe);
	let index = probe;
	if (!mark && start === end && start > 0) {
		index = start - 1;
		mark = pick(index);
	}
	if (!mark) {
		return null;
	}

	let from = index;
	while (
		from > 0 &&
		pick(from - 1) &&
		sameMark(pick(from - 1) as Mark, mark)
	) {
		from--;
	}
	let to = index + 1;
	while (to < units.length && pick(to) && sameMark(pick(to) as Mark, mark)) {
		to++;
	}
	if (start !== end && (start < from || end > to)) {
		return null;
	}
	return { start: from, end: to, mark };
}

/**
 * Links a range. A collapsed range inserts the URL as the link text.
 *
 * @param doc        Document.
 * @param range      Selection.
 * @param attributes Link attributes; href first.
 * @param profile    Effective profile.
 */
export function setLink(
	doc: Doc,
	range: Range,
	attributes: Attributes,
	profile: Profile
): EditResult {
	const mark: Mark = { name: 'a', attributes };
	const existing = linkAt(doc, range);
	const target = ordered(range);
	const span = target.start === target.end && existing ? existing : target;

	if (span.start === span.end) {
		const href = attributes.find(([name]) => name === 'href')?.[1] ?? '';
		const marks = marksAt(doc, span.start);
		const inserted = textUnits(href, [...marks, mark]);
		const result = replaceRange(doc, span, inserted, profile);
		return {
			doc: result.doc,
			selection: { start: span.start, end: span.start + inserted.length },
		};
	}

	const units = toUnits(doc);
	const next = units.map((unit, index) =>
		index >= span.start && index < span.end
			? {
					...unit,
					marks: [...unit.marks.filter((m) => m.name !== 'a'), mark],
				}
			: unit
	);
	return {
		doc: fromUnits(next, profile),
		selection: { start: span.start, end: span.end },
	};
}

/**
 * Removes the link around the caret, or every link in a range.
 *
 * @param doc     Document.
 * @param range   Selection.
 * @param profile Effective profile.
 */
export function removeLink(
	doc: Doc,
	range: Range,
	profile: Profile
): EditResult {
	const target = ordered(range);
	const existing = target.start === target.end ? linkAt(doc, target) : null;
	const span = existing ?? target;
	const units = toUnits(doc);
	const next = units.map((unit, index) =>
		index >= span.start && index < span.end
			? { ...unit, marks: unit.marks.filter((mark) => mark.name !== 'a') }
			: unit
	);
	return { doc: fromUnits(next, profile), selection: target };
}
