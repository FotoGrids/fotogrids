/**
 * Every icon a settings catalog node names exists in the admin icon set.
 */
import fs from 'fs';
import path from 'path';
import icons from '@/admin/plain/icons';

const CATALOG_DIR = path.resolve(
	__dirname,
	'../../../assets/admin/plain/collection-settings'
);

// loading-icons.js adds these to the icon set at runtime as `loading_icon_<key>`.
const LOADING_ICONS = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, '../../../config/loading-icons-smil.json'),
		'utf8'
	)
);
const LOADING_PREFIX = 'loading_icon_';

const resolves = (icon) =>
	typeof icons[icon] === 'string' ||
	(icon.startsWith(LOADING_PREFIX) &&
		typeof LOADING_ICONS[icon.slice(LOADING_PREFIX.length)] === 'string');

const catalogFiles = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return catalogFiles(full);
		}
		return entry.name.endsWith('.json') ? [full] : [];
	});

const collectIcons = (node, found, where) => {
	if (Array.isArray(node)) {
		node.forEach((child) => collectIcons(child, found, where));
		return;
	}
	if (!node || typeof node !== 'object') {
		return;
	}
	if (typeof node.icon === 'string' && node.icon !== '') {
		found.push({ icon: node.icon, where });
	}
	Object.values(node).forEach((child) => collectIcons(child, found, where));
};

describe('catalog icons', () => {
	const referenced = [];
	catalogFiles(CATALOG_DIR).forEach((file) => {
		collectIcons(
			JSON.parse(fs.readFileSync(file, 'utf8')),
			referenced,
			path.relative(CATALOG_DIR, file)
		);
	});

	it('finds icon references to check', () => {
		expect(referenced.length).toBeGreaterThan(0);
	});

	it('resolves every referenced icon', () => {
		const missing = referenced
			.filter(({ icon }) => !resolves(icon))
			.map(({ icon, where }) => `${where}: ${icon}`);
		expect(missing).toEqual([]);
	});

	it.each([
		['item_align_center'],
		['lightbox_full'],
		['lightbox_mini'],
		['lightbox_grid'],
	])('ships %s as a single-colour line icon', (name) => {
		const svg = icons[name];
		expect(svg).toContain('stroke="currentColor"');
		expect(svg).not.toMatch(/(fill|stroke)="#/);
	});
});
