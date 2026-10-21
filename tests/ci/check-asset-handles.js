/**
 * Fails when one frontend asset file is enqueued under more than one handle;
 * WordPress then loads it once per handle.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const scanDirs = ['src/public', 'src/includes/modules/ViewCollections'];

function phpFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			phpFiles(full, out);
		} else if (entry.name.endsWith('.php')) {
			out.push(full);
		}
	}
	return out;
}

const handlesByFile = {};
function record(file, handle, source) {
	handlesByFile[file] = handlesByFile[file] || {};
	handlesByFile[file][handle] = handlesByFile[file][handle] || new Set();
	handlesByFile[file][handle].add(source);
}

for (const dir of scanDirs) {
	for (const file of phpFiles(path.join(root, dir))) {
		const php = fs.readFileSync(file, 'utf8');
		const source = path.relative(root, file);
		for (const m of php.matchAll(
			/'([\w-]+)'\s*=>\s*new\s+Asset_Decl\(\s*'([^']+)'/g
		)) {
			record(path.posix.normalize('public/render/' + m[2]), m[1], source);
		}
		for (const m of php.matchAll(
			/wp_(?:enqueue|register)_(?:style|script)\(\s*'([\w-]+)'\s*,\s*FOTOGRIDS_PLUGIN_URL\s*\.\s*'([^']+)'/g
		)) {
			record(path.posix.normalize(m[2]), m[1], source);
		}
	}
}

const offenders = Object.entries(handlesByFile).filter(
	([, handles]) => Object.keys(handles).length > 1
);

if (offenders.length) {
	console.log('Asset files enqueued under more than one handle:');
	for (const [file, handles] of offenders) {
		console.log(`  ${file}`);
		for (const [handle, sources] of Object.entries(handles)) {
			console.log(`    ${handle} <- ${[...sources].join(', ')}`);
		}
	}
	process.exit(1);
}

console.log(
	`OK: ${Object.keys(handlesByFile).length} frontend asset files, one handle each.`
);
