import {
	getItemSeoChecks,
	summarizeSeoChecks,
	resolveEmittedAlt,
	CHECK_PASS,
	CHECK_WARN,
	CHECK_FAIL,
	CHECK_INFO,
	BAND_BAD,
	BAND_NEEDS_IMPROVEMENT,
	BAND_GOOD,
} from '../../assets/admin/src/components/item-edit-modal/seo-checks';

const byId = (checks, id) => checks.find((item) => item.id === id);

const goodForm = {
	title: 'Sunrise over the harbour',
	alt: 'Fishing boats moored at a harbour wall at sunrise',
	caption: 'Early light on the east quay.',
	description: 'Shot on the first morning of the residency.',
	credit: 'Mark Rean',
};

const goodItem = {
	filename: 'harbour-sunrise-boats.jpg',
	filesize: '480 KB',
	width: 1600,
	height: 1067,
};

describe('getItemSeoChecks', () => {
	it('passes every check for a fully described item', () => {
		const checks = getItemSeoChecks(goodForm, goodItem);

		checks.forEach((item) => {
			expect(item.status).toBe(CHECK_PASS);
		});

		expect(summarizeSeoChecks(checks)).toEqual({
			ready: 7,
			total: 7,
			band: BAND_GOOD,
		});
	});

	it('returns results for empty input without throwing', () => {
		const checks = getItemSeoChecks();

		expect(checks).toHaveLength(7);
		expect(byId(checks, 'alt').status).toBe(CHECK_FAIL);
		expect(byId(checks, 'title').status).toBe(CHECK_FAIL);
	});

	describe('alt text', () => {
		it('fails when empty', () => {
			const check = byId(
				getItemSeoChecks({ ...goodForm, alt: '  ' }, goodItem),
				'alt'
			);

			expect(check.status).toBe(CHECK_FAIL);
			expect(check.code).toBe('alt_missing');
			expect(check.tab).toBe('details');
			expect(check.fieldId).toBe('fotogrids-item-alt');
		});

		it('warns when shorter than three words', () => {
			const check = byId(
				getItemSeoChecks(
					{ ...goodForm, alt: 'Harbour boats' },
					goodItem
				),
				'alt'
			);

			expect(check.code).toBe('alt_short');
			expect(check.status).toBe(CHECK_WARN);
		});

		it('warns when over 125 characters', () => {
			const check = byId(
				getItemSeoChecks(
					{ ...goodForm, alt: 'a'.repeat(126) },
					goodItem
				),
				'alt'
			);

			expect(check.code).toBe('alt_long');
			expect(check.detail).toBe('126 / 125');
		});

		it('warns when it only repeats the title, ignoring separators and case', () => {
			const check = byId(
				getItemSeoChecks(
					{ ...goodForm, alt: 'sunrise-over_the  HARBOUR' },
					goodItem
				),
				'alt'
			);

			expect(check.code).toBe('alt_same_as_title');
		});
	});

	describe('filename', () => {
		it.each([
			'IMG_4471.jpg',
			'DSC0001.JPG',
			'dscf1234.raf',
			'_MG_8891.jpg',
			'PXL_20260103.jpg',
			'Screenshot 2026-09-03 at 10.12.44.png',
			'screen-shot-2026-01-02.png',
			'20260103.jpeg',
			'a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp',
			'DSC_1234-1.jpg',
			'IMG_4471-2.jpg',
			'DSC_1234-1-2.jpg',
			'20260103-1.jpeg',
		])('flags %s as a camera default', (filename) => {
			const check = byId(
				getItemSeoChecks(goodForm, { ...goodItem, filename }),
				'filename'
			);

			expect(check.code).toBe('filename_generic');
			expect(check.status).toBe(CHECK_WARN);
			expect(check.detail).toBe(filename);
		});

		it.each([
			'harbour-sunrise-boats.jpg',
			'fishing-boats-east-quay.jpg',
			'moored-boat-harbour-wall-2.webp',
		])('accepts %s', (filename) => {
			const check = byId(
				getItemSeoChecks(goodForm, { ...goodItem, filename }),
				'filename'
			);

			expect(check.code).toBe('filename_ok');
		});

		it('reports info when there is no filename', () => {
			const check = byId(
				getItemSeoChecks(goodForm, { ...goodItem, filename: '' }),
				'filename'
			);

			expect(check.status).toBe(CHECK_INFO);
			expect(check.counts).toBe(false);
		});
	});

	describe('title', () => {
		it('warns when the title is still the filename stem', () => {
			const check = byId(
				getItemSeoChecks(
					{
						...goodForm,
						alt: 'Fishing boats at the quay wall',
						title: 'harbour-sunrise-boats',
					},
					goodItem
				),
				'title'
			);

			expect(check.code).toBe('title_from_filename');
		});
	});

	describe('credit', () => {
		it('falls back to the EXIF copyright field', () => {
			const check = byId(
				getItemSeoChecks(
					{
						...goodForm,
						credit: '',
						exif: { copyright: '(c) Mark Rean' },
					},
					goodItem
				),
				'credit'
			);

			expect(check.code).toBe('credit_from_exif');
			expect(check.status).toBe(CHECK_PASS);
			expect(check.detail).toBe('(c) Mark Rean');
		});

		it('warns when neither credit nor EXIF copyright is set', () => {
			const check = byId(
				getItemSeoChecks({ ...goodForm, credit: '' }, goodItem),
				'credit'
			);

			expect(check.code).toBe('credit_missing');
		});
	});

	describe('file weight', () => {
		it('warns above one megabyte', () => {
			const check = byId(
				getItemSeoChecks(goodForm, { ...goodItem, filesize: '4.2 MB' }),
				'weight'
			);

			expect(check.code).toBe('weight_heavy');
			expect(check.detail).toBe('4.2 MB · 1600 × 1067');
		});

		it('warns on an oversized long edge even when the file is small', () => {
			const check = byId(
				getItemSeoChecks(goodForm, {
					...goodItem,
					filesize: '600 KB',
					width: 6000,
					height: 4000,
				}),
				'weight'
			);

			expect(check.code).toBe('weight_large');
		});

		it('reports info when neither size nor dimensions are known', () => {
			const check = byId(
				getItemSeoChecks(goodForm, {
					filename: 'a-real-name.jpg',
					filesize: '',
					width: '',
					height: '',
				}),
				'weight'
			);

			expect(check.status).toBe(CHECK_INFO);
		});

		it('excludes non-counting checks from the tally', () => {
			const checks = getItemSeoChecks(goodForm, {
				filename: 'a-real-name.jpg',
			});

			expect(summarizeSeoChecks(checks).total).toBe(6);
		});
	});
});

describe('filename quality', () => {
	const codeFor = (filename, form = goodForm) =>
		getItemSeoChecks(form, { ...goodItem, filename }).find(
			(item) => item.id === 'filename'
		).code;

	it.each([
		'photo.jpg',
		'final-copy.jpg',
		'untitled.png',
		'web-ready-image.jpg',
		'image-1024x768.jpg',
		'edited-v2.jpg',
		'pexels-photo.jpg',
		'a.jpg',
		'export-final-small.webp',
	])('flags %s as carrying no keywords', (filename) => {
		expect(codeFor(filename)).toBe('filename_no_keywords');
	});

	it.each([
		'hover-demo-5-2.webp',
		'banner-final-2.jpg',
		'hero-image-3.png',
		'sunset.jpg',
		'my-gallery-4.webp',
		'lighthouse.jpg',
	])('flags %s as carrying only one descriptive word', (filename) => {
		expect(codeFor(filename)).toBe('filename_too_short');
	});

	it.each([
		'hover-effect-demo-grid.webp',
		'kitchen-renovation-1024x768.jpg',
		'unsplash-mountain-ridge.jpg',
	])('flags %s as unrelated to what the item says', (filename) => {
		expect(codeFor(filename)).toBe('filename_unrelated');
	});

	it('matches related word forms rather than requiring an exact token', () => {
		const porto = {
			title: 'Doorway, Portugal',
			alt: 'A red door in a Portugal side street',
		};

		expect(codeFor('red-door-porto.jpg', porto)).toBe('filename_ok');
		expect(codeFor('fishing-boats-harbour.jpg', goodForm)).toBe(
			'filename_ok'
		);
	});

	it('skips the relatedness test when the item has no text to compare against', () => {
		const blank = { title: '', alt: '', caption: '' };

		expect(codeFor('hover-effect-demo-grid.webp', blank)).toBe(
			'filename_ok'
		);
	});

	it('prefers the camera-default message when both would match', () => {
		expect(codeFor('IMG_4471.jpg')).toBe('filename_generic');
	});

	it('is not defeated by a duplicate-upload suffix', () => {
		expect(codeFor('DSC_1234.jpg')).toBe('filename_generic');
		expect(codeFor('DSC_1234-1.jpg')).toBe('filename_generic');
	});
});

describe('summarizeSeoChecks bands', () => {
	const bandFor = (form, item = goodItem) =>
		summarizeSeoChecks(getItemSeoChecks(form, item)).band;

	it('is bad when a required field is missing, however complete the rest is', () => {
		expect(bandFor({ ...goodForm, alt: '' })).toBe(BAND_BAD);
		expect(bandFor({ ...goodForm, title: '' })).toBe(BAND_BAD);
	});

	it('is bad on an empty item', () => {
		expect(bandFor({})).toBe(BAND_BAD);
	});

	it('is bad once four checks warn', () => {
		expect(
			bandFor(
				{ ...goodForm, caption: '', description: '', credit: '' },
				{ ...goodItem, filesize: '5 MB' }
			)
		).toBe(BAND_BAD);
	});

	it('needs improvement on two or three warnings', () => {
		expect(bandFor({ ...goodForm, caption: '', description: '' })).toBe(
			BAND_NEEDS_IMPROVEMENT
		);
		expect(
			bandFor({ ...goodForm, caption: '', description: '', credit: '' })
		).toBe(BAND_NEEDS_IMPROVEMENT);
	});

	it('stays good with a single unfixable warning, such as the filename', () => {
		expect(
			bandFor(goodForm, { ...goodItem, filename: 'IMG_4471.jpg' })
		).toBe(BAND_GOOD);
	});
});

describe('resolveEmittedAlt', () => {
	it('uses the alt text when set', () => {
		expect(resolveEmittedAlt(goodForm)).toEqual({
			value: 'Fishing boats moored at a harbour wall at sunrise',
			source: 'alt',
		});
	});

	it('falls back to the title, matching the renderer', () => {
		expect(resolveEmittedAlt({ ...goodForm, alt: '' })).toEqual({
			value: 'Sunrise over the harbour',
			source: 'title',
		});
	});

	it('reports an empty alt when neither is set', () => {
		expect(resolveEmittedAlt({})).toEqual({ value: '', source: 'empty' });
	});
});
