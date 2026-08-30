// ============================================================================
//  armature-io.js — the ONE reader for brushstroke.armature/1 files
// ============================================================================
// Shared by the armature editor, the reveal, and (handoff 06) the contact sheet.
// No consumer parses armature JSON itself: a second parser is a second set of
// validation rules, and the failure it hides is "a wrong composition rendered
// confidently", which is worse than an error.
//
// Schema documented in SPEC — see `brushstroke.armature/1`. The file records
// PLACEMENT ONLY: no reveal, no timing, no ground, no composition.
//
// Contract:
//   ArmatureIO.parse(textOrObject, {frameW, frameH})  → {ok:true, block}
//                                                     | {ok:false, error}
//   ArmatureIO.listFolder()        → Promise<[{name, file}]>   (never throws)
//   ArmatureIO.loadFromFolder(nm, {frameW, frameH}) → Promise<parse result>
//
// parse() NEVER partially loads and NEVER substitutes a default. Callers apply
// the block only on {ok:true} and must show `error` to the user otherwise.
(function(global){
  'use strict';

  const SCHEMA_PREFIX = 'brushstroke.armature/';
  const SUPPORTED     = '1';
  const FOLDER        = 'armatures/';
  const INDEX         = FOLDER + 'index.json';

  function fail(msg){ return { ok:false, error:msg }; }

  // Validate hard, in one place, before any state is touched anywhere.
  function parse(input, opts){
    opts = opts || {};
    let j = input;
    if(typeof input === 'string'){
      try { j = JSON.parse(input); }
      catch(e){ return fail('Not valid JSON: ' + e.message); }
    }
    if(!j || typeof j !== 'object' || Array.isArray(j))
      return fail('Armature must be a JSON object.');

    const tag = j.schema;
    if(typeof tag !== 'string' || tag.indexOf(SCHEMA_PREFIX) !== 0)
      return fail("Not a brushstroke.armature file (schema was '" + tag + "').");
    const version = tag.slice(SCHEMA_PREFIX.length);
    if(version !== SUPPORTED)
      return fail('Unsupported armature version ' + version + ' — this build reads ' +
                  SCHEMA_PREFIX + SUPPORTED + '. Refusing rather than guessing.');

    if(!Array.isArray(j.placements)) return fail('Armature has no placements array.');
    if(!j.frame || typeof j.frame.w !== 'number' || typeof j.frame.h !== 'number')
      return fail('Armature has no frame dimensions — positions are absolute, so they cannot be placed.');

    // Coordinates are absolute to the authored frame. Rescaling is NOT defined
    // here on purpose (see the schema note in SPEC): refuse, don't invent a rule.
    if(opts.frameW != null && opts.frameH != null &&
       (j.frame.w !== opts.frameW || j.frame.h !== opts.frameH))
      return fail('Armature was authored at ' + j.frame.w + '×' + j.frame.h +
                  ' but this canvas is ' + opts.frameW + '×' + opts.frameH +
                  '. Positions are absolute, so it would not line up. Refusing to rescale.');

    const seen = new Set();
    for(let i=0;i<j.placements.length;i++){
      const p = j.placements[i], at = 'placements[' + i + ']';
      if(!p || typeof p !== 'object') return fail(at + ' is not an object.');
      // `id` is load-bearing: marks seed by it, so a missing or duplicated id
      // silently changes how figures draw.
      if(!Number.isInteger(p.id))    return fail(at + ' has no integer id — ids are what marks seed by.');
      if(seen.has(p.id))             return fail(at + ' repeats id ' + p.id + ' — ids must be unique.');
      seen.add(p.id);
      if(typeof p.gen !== 'string' || !p.gen) return fail(at + ' has no generator id.');
      if(typeof p.x !== 'number' || typeof p.y !== 'number')
        return fail(at + ' has a non-numeric position.');
      if(p.scaleMul != null && (typeof p.scaleMul !== 'number' || !(p.scaleMul > 0)))
        return fail(at + ' has an invalid scaleMul.');
      if(p.seedOff != null && !Number.isInteger(p.seedOff))
        return fail(at + ' has a non-integer seedOff.');
    }
    return { ok:true, block:j };
  }

  // Folder mode is READ-ONLY and static: a manifest plus files, fetched. No write
  // endpoint, so it works identically in Safari and Chrome.
  async function listFolder(){
    try {
      const res = await fetch(INDEX, { cache:'no-store' });
      if(!res.ok) return [];
      const idx = await res.json();
      const files = Array.isArray(idx) ? idx : (idx.armatures || []);
      return files.map(f => (typeof f === 'string')
        ? { name: f.replace(/\.armature\.json$/,'').replace(/\.json$/,''), file: f }
        : f);
    } catch(e){ return []; }        // no folder / no server — the picker still works
  }

  async function loadFromFolder(name, opts){
    const entries = await listFolder();
    const hit = entries.find(e => e.name === name || e.file === name);
    if(!hit) return fail("No armature named '" + name + "' in " + FOLDER + '.');
    try {
      const res = await fetch(FOLDER + hit.file, { cache:'no-store' });
      if(!res.ok) return fail('Could not read ' + FOLDER + hit.file + ' (HTTP ' + res.status + ').');
      return parse(await res.text(), opts);
    } catch(e){ return fail('Could not read ' + FOLDER + hit.file + ': ' + e.message); }
  }

  global.ArmatureIO = { SCHEMA_PREFIX, SUPPORTED, FOLDER, parse, listFolder, loadFromFolder };
})(window);
