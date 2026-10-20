#!/usr/bin/env node
/**
 * Fails when the PHP and JS justified cutters disagree: replays the cases from
 * justified-cut-cases.php through page-cutter.js and compares rows and pages.
 *
 * Skips without php unless FOTOGRIDS_REQUIRE_PHP_TESTS=1.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CUTTER = path.join(
	ROOT,
	'src/public/render/layouts/justified/page-cutter.js'
);
const requirePhp = '1' === process.env.FOTOGRIDS_REQUIRE_PHP_TESTS;

if (0 !== spawnSync('php', ['-v']).status) {
	if (requirePhp) {
		console.error(
			'ERROR: php not found, but FOTOGRIDS_REQUIRE_PHP_TESTS=1.'
		);
		process.exit(1);
	}
	console.warn('WARN: php not found; skipping justified cut parity.');
	process.exit(0);
}

if (!fs.existsSync(CUTTER)) {
	console.error(`ERROR: JS cutter not found: ${CUTTER}`);
	process.exit(1);
}

const cases = JSON.parse(
	execFileSync('php', [path.join(__dirname, 'justified-cut-cases.php')], {
		cwd: ROOT,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	})
);

const source = fs.readFileSync(CUTTER, 'utf8');

import(`data:text/javascript,${encodeURIComponent(source)}`).then((cutter) => {
	const camel = (rules) => ({
		mode: rules.mode,
		target: rules.target,
		window: rules.window,
		threshold: rules.threshold,
		direction: rules.direction,
		maxRows: rules.max_rows,
		pageEndHide: rules.page_end_hide,
	});
	const failures = [];

	cases.forEach((c, i) => {
		const g = {
			width: c.geometry.width,
			gap: c.geometry.gap,
			rowHeight: c.geometry.row_height,
		};
		const rows = cutter.packRows(c.aspects, g.width, g.gap, g.rowHeight);
		const pages = cutter.cutPages(c.aspects, g, camel(c.rules), c.start);
		if (JSON.stringify(rows) !== JSON.stringify(c.rows)) {
			failures.push(`case ${i}: rows differ`);
		}
		if (
			JSON.stringify(pages) !==
			JSON.stringify(
				c.pages.map((p) => ({ offset: p.offset, size: p.size }))
			)
		) {
			failures.push(
				`case ${i}: pages differ — php ${JSON.stringify(c.pages)} js ${JSON.stringify(pages)}`
			);
		}
	});

	if (failures.length) {
		console.error(
			`justified cut parity: ${failures.length} of ${cases.length} cases differ`
		);
		failures.slice(0, 10).forEach((f) => console.error(`  ${f}`));
		process.exit(1);
	}
	console.warn(`justified cut parity: ${cases.length} cases identical`);
});
