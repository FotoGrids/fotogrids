/**
 * One-off: convert loading-icons.json to loading-icons.yaml with multiline SVG values.
 * Run once to create the YAML source; after that edit .yaml and run loading-icons-build.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/config/loading-icons.json');
const YAML_PATH = path.join(ROOT, 'src/config/loading-icons.yaml');

function escapeYamlLiteral(str) {
  return str.replace(/\r/g, '').replace(/\n/g, '\n  ');
}

function toMultiline(svg) {
  if (typeof svg !== 'string') return svg;
  const parts = svg.split(/></);
  if (parts.length <= 1) return '  ' + svg;
  const indent = '  ';
  const lines = [];
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i].trim();
    if (!t) continue;
    if (i === 0) lines.push(indent + t + '>');
    else if (i === parts.length - 1) lines.push(indent + '<' + t);
    else lines.push(indent + '<' + t + '>');
  }
  return lines.join('\n');
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const lines = ['# FotoGrids loading icons (YAML source). Edit here; run "npm run icons:build" to update JSON.', ''];

for (const [key, value] of Object.entries(data)) {
  const svg = typeof value === 'string' ? value : (Array.isArray(value) ? value.join('') : value);
  lines.push(key + ': |');
  lines.push(toMultiline(svg));
  lines.push('');
}

fs.writeFileSync(YAML_PATH, lines.join('\n'), 'utf8');
console.log('Wrote', YAML_PATH);
