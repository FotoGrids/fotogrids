import fixtures from '../fixtures/format.json';
import {
	bundledProfile,
	normalize,
	render,
	toHtml,
	toPlainText,
	validateProfile,
	type FormatOptions,
} from '../index';

interface Fixture {
	name: string;
	input: string;
	options?: FormatOptions;
	profile?: unknown;
	html: string;
	text?: string;
	normalized?: string;
	lossy?: boolean;
}

const cases = fixtures as Fixture[];

describe('formatted-text fixtures', () => {
	describe.each(cases.map((fixture) => [fixture.name, fixture] as const))(
		'%s',
		(_name, fixture) => {
			const profile = fixture.profile
				? validateProfile(fixture.profile)
				: bundledProfile();

			it('formats as HTML', () => {
				expect(
					toHtml(fixture.input, profile, fixture.options ?? {})
				).toBe(fixture.html);
			});

			if (fixture.text !== undefined) {
				it('converts to plain text', () => {
					expect(toPlainText(fixture.input, profile)).toBe(
						fixture.text
					);
				});
			}

			if (fixture.normalized !== undefined) {
				it('normalizes the stored form', () => {
					expect(normalize(fixture.input, profile).html).toBe(
						fixture.normalized
					);
				});
			}

			if (fixture.lossy !== undefined) {
				it('reports whether normalizing drops anything', () => {
					expect(normalize(fixture.input, profile).lossy).toBe(
						fixture.lossy
					);
				});
			}
		}
	);
});

describe('render', () => {
	it('builds nodes without assigning markup', () => {
		const target = document.createElement('p');
		const spy = jest.spyOn(target, 'innerHTML', 'set');
		render(
			target,
			'Go <a href="/x" onclick="x()">there</a>\nnow <img src=x onerror=alert(1)>',
			bundledProfile(),
			{
				policy: { newTab: true, rel: [] },
				newTabLabel: '(opens in a new tab)',
			}
		);
		expect(spy).not.toHaveBeenCalled();
		expect(target.querySelectorAll('img')).toHaveLength(0);
		const link = target.querySelector('a') as HTMLAnchorElement;
		expect(link.getAttribute('onclick')).toBeNull();
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener');
		expect(target.querySelectorAll('br')).toHaveLength(1);
		expect(target.textContent).toBe('Go there (opens in a new tab)now');
	});

	it('replaces existing children', () => {
		const target = document.createElement('p');
		target.textContent = 'old';
		render(target, 'new');
		expect(target.textContent).toBe('new');
	});
});

describe('validateProfile', () => {
	it('drops unknown keys, bad names and floor entries', () => {
		const profile = validateProfile({
			elements: {
				'bad name': {},
				iframe: {},
				u: {
					attributes: {
						onmouseover: { type: 'text' },
						'data-x': { type: 'text' },
						lang: { type: 'text' },
					},
				},
			},
			protocols: ['HTTPS', 'javascript', 'data', 'vbscript', '1bad'],
			breakBefore: ['p', 'Bad Name'],
			dropWithContent: 'nope',
			extra: true,
		});
		expect(Object.keys(profile.elements)).toEqual(['u']);
		expect(profile.elements.u.attributes).toEqual({
			lang: { type: 'text' },
		});
		expect(profile.protocols).toEqual(['https']);
		expect(profile.breakBefore).toEqual(['p']);
		expect(profile.dropWithContent).toEqual([]);
		expect(Object.keys(profile)).toEqual([
			'elements',
			'protocols',
			'breakBefore',
			'dropWithContent',
		]);
	});

	it('forces URL attributes to the url type', () => {
		const profile = validateProfile({
			elements: { a: { attributes: { href: { type: 'text' } } } },
			protocols: ['https'],
		});
		expect(profile.elements.a.attributes?.href).toEqual({ type: 'url' });
	});

	it('rejects enum and token attributes without values', () => {
		const profile = validateProfile({
			elements: {
				a: {
					attributes: {
						target: { type: 'enum', values: [] },
						rel: { type: 'tokens' },
					},
				},
			},
		});
		expect(profile.elements.a.attributes).toBeUndefined();
	});

	it('handles a missing definition', () => {
		expect(validateProfile(null)).toEqual({
			elements: {},
			protocols: [],
			breakBefore: [],
			dropWithContent: [],
		});
	});
});
