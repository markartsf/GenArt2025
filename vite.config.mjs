import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Brushstroke preset API (dev server only)
//
// Lets project-brushstroke/brush-lab.html read and write preset files in
// project-brushstroke/presets/ over fetch, so saved presets live on disk
// (version-controlled, Composition-readable) instead of only in localStorage.
// See project-brushstroke/SPEC.md §1.5 decision 4.
//
//   GET    /__presets          → { presets: [{ name, preset }] }  (lists the folder)
//   PUT    /__presets/<name>   → write <name>.json (body = brushstroke.preset/1)
//   DELETE /__presets/<name>   → remove <name>.json
//
// Every write/delete regenerates presets/index.json so the manifest never drifts.
// This middleware is additive and namespaced; default Vite behavior is untouched.
// ---------------------------------------------------------------------------

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR  = path.join(__dirname, 'project-brushstroke', 'presets');
const PRESET_SCHEMA = 'brushstroke.preset/1';
const PRESET_API_PREFIX = '/__presets';
const NAME_RE       = /^[A-Za-z0-9_-]+$/;

// Resolve a preset name to an absolute path, refusing anything outside PRESETS_DIR.
function safePresetPath(rawName) {
  const bare = String(rawName).replace(/\.json$/i, '');
  if (!NAME_RE.test(bare)) return null;
  const file = path.resolve(PRESETS_DIR, bare + '.json');
  if (path.dirname(file) !== path.resolve(PRESETS_DIR)) return null;   // no traversal
  return file;
}

function listPresetFiles() {
  if (!fs.existsSync(PRESETS_DIR)) return [];
  return fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort();
}

function listPresets() {
  return listPresetFiles().map(f => {
    try {
      return { name: f.replace(/\.json$/, ''), preset: JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, f), 'utf8')) };
    } catch { return null; }
  }).filter(Boolean);
}

// Keep presets/index.json in sync with whatever files exist.
function regenerateIndex() {
  const idx = { schema: 'brushstroke.presetindex/1', presets: listPresetFiles() };
  fs.writeFileSync(path.join(PRESETS_DIR, 'index.json'), JSON.stringify(idx, null, 2) + '\n');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function brushstrokePresetsApi() {
  return {
    name: 'brushstroke-presets-api',
    configureServer(server) {
      console.log(`[presets] ${PRESET_API_PREFIX} API mounted → ${PRESETS_DIR}`);
      server.middlewares.use(PRESET_API_PREFIX, async (req, res) => {
        const send = (code, obj) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        try {
          // Normalize whether or not connect stripped the mount prefix, so both
          // "/__presets" and the stripped "/" forms resolve identically.
          let sub = (req.url || '/').split('?')[0];
          if (sub.startsWith(PRESET_API_PREFIX)) sub = sub.slice(PRESET_API_PREFIX.length);
          if (sub === '') sub = '/';
          console.log(`[presets] ${req.method} ${req.originalUrl || req.url} → "${sub}"`);

          // GET /__presets  → list the folder
          if (req.method === 'GET' && sub === '/') {
            return send(200, { presets: listPresets() });
          }

          const m = sub.match(/^\/([^/]+)$/);
          if (!m) return send(404, { error: 'not found' });
          const file = safePresetPath(decodeURIComponent(m[1]));
          if (!file) return send(400, { error: 'invalid preset name' });

          if (req.method === 'PUT') {
            let preset;
            try { preset = JSON.parse(await readBody(req)); }
            catch { return send(400, { error: 'invalid JSON body' }); }
            if (!preset || preset.schema !== PRESET_SCHEMA) {
              return send(400, { error: 'body is not a ' + PRESET_SCHEMA });
            }
            fs.mkdirSync(PRESETS_DIR, { recursive: true });
            fs.writeFileSync(file, JSON.stringify(preset, null, 2) + '\n');
            regenerateIndex();
            return send(200, { ok: true, name: path.basename(file, '.json') });
          }

          if (req.method === 'DELETE') {
            if (fs.existsSync(file)) fs.unlinkSync(file);
            regenerateIndex();
            return send(200, { ok: true });
          }

          return send(405, { error: 'method not allowed' });
        } catch (e) {
          send(500, { error: String((e && e.message) || e) });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [brushstrokePresetsApi()]
});
