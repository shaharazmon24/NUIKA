// Find the film's cuts and write scripts/media/shots.json.
//
//   node scripts/media/detect-shots.mjs [threshold]
//
// The threshold matters more than it looks. At 0.25 this found 37 cuts and
// missed a third of them — including a hard cut at 113.9s from a seeded loaf
// to a wide shot of the kitchen. Both sides of that cut are warm, evenly lit
// interiors, so the scene score stayed under the bar. The phone cut inherited
// the miss: one window covered both scenes, and the second half of the "shot"
// framed a wall.
//
// Counting cuts against the threshold shows where the real answer is:
//
//     0.25 -> 37     0.15 -> 51
//     0.20 -> 50     0.12 -> 52
//                    0.10 -> 52     0.08 -> 54
//
// It plateaus at 52 across 0.12 and 0.10, and only starts inventing cuts below
// that. 0.12 sits on the plateau with room above the noise.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = join(HERE, '..', '..', 'Film', 'LONG V1.mp4');
const THRESHOLD = Number(process.argv[2] || 0.12);
const MIN_LEN = 0.4;   // shorter than this is a flash, not a shot

const out = execFileSync('ffmpeg', ['-nostdin', '-i', FILM,
  '-vf', `select='gt(scene,${THRESHOLD})',metadata=print:file=-`,
  '-an', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });

// Match pts_time directly. Splitting these lines on '=' finds one cut instead
// of fifty — the field is "pts_time:12.34", with a colon.
const cuts = [];
const lines = out.split('\n');
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].match(/pts_time:([0-9.]+)/);
  if (t) cuts.push(+t[1]);
}

const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', FILM], { encoding: 'utf8' }).trim();

const bounds = [0, ...cuts, dur];
const shots = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const start = bounds[i], end = bounds[i + 1];
  if (end - start < MIN_LEN) continue;
  shots.push({ i: shots.length + 1, start: +start.toFixed(2), end: +end.toFixed(2), len: +(end - start).toFixed(2) });
}

writeFileSync(join(HERE, 'shots.json'), JSON.stringify(shots, null, 2) + '\n');

console.log(`threshold ${THRESHOLD}: ${cuts.length} cuts, ${shots.length} shots over ${dur.toFixed(2)}s`);
const lens = shots.map(s => s.len).sort((a, b) => a - b);
console.log(`shortest ${lens[0]}s, median ${lens[lens.length >> 1]}s, longest ${lens[lens.length - 1]}s`);
const long = shots.filter(s => s.len >= 5);
console.log(`${long.length} shots of 5s or more${long.length ? ': ' + long.map(s => `#${s.i} ${s.len}s`).join(', ') : ''}`);
console.log(`\nwrote shots.json — next: choose a window per shot, then check the render, not the guess.`);
