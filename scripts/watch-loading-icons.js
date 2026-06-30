/**
 * Watches src/config/loading-icons.yaml and runs icons:build on change.
 * Used with "npm run dev" so editing the YAML updates the JSON and webpack re-copies to dist.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'src/config/loading-icons.yaml');
const BUILD_SCRIPT = path.join(__dirname, 'loading-icons-build.js');

const DEBOUNCE_MS = 300;
let debounceTimer = null;

function runBuild() {
  const child = spawn(process.execPath, [BUILD_SCRIPT], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  child.on('error', (err) => console.error('icons:build error', err));
}

function onYamlChange() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    console.log('[watch-loading-icons] loading-icons.yaml changed, running icons:build');
    runBuild();
  }, DEBOUNCE_MS);
}

if (!fs.existsSync(YAML_PATH)) {
  console.warn('[watch-loading-icons] Not found:', YAML_PATH);
  process.exit(1);
}

console.log('[watch-loading-icons] Watching', YAML_PATH);
fs.watch(YAML_PATH, { persistent: true }, (eventType, filename) => {
  if (filename) onYamlChange();
});
