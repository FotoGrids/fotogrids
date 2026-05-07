/**
 * Build script: YAML (source) → JSON.
 * Source file already contains __FG_ID__ placeholders; no injection in build.
 * Run as part of npm run build and npm run dev so dist gets loading-icons.json.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'src/config/loading-icons.yaml');
const JSON_FALLBACK = path.join(ROOT, 'src/config/loading-icons.json');
const JSON_OUT = path.join(ROOT, 'src/config/loading-icons.json');

function loadSource() {
  if (fs.existsSync(YAML_PATH)) {
    try {
      const content = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(content);
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    } catch (e) {
      console.error('loading-icons: YAML parse failed:', e.message);
      process.exit(1);
    }
  }
  if (fs.existsSync(JSON_FALLBACK)) {
    const content = fs.readFileSync(JSON_FALLBACK, 'utf8');
    return JSON.parse(content);
  }
  console.error('loading-icons: neither loading-icons.yaml nor loading-icons.json found');
  process.exit(1);
}

function main() {
  const data = loadSource();
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const svg = typeof value === 'string' ? value : (Array.isArray(value) ? value.join('') : String(value));
    out[key] = svg;
  }
  fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('loading-icons: wrote', JSON_OUT);
}

main();
