// Cut the two versions of the film that the home page plays, plus the two
// posters that stand in for them.
//
//   node scripts/media/build-film.mjs
//
// Needs `Film/LONG V1.mp4`, which is git-ignored (it is about a gigabyte).
// The output in `media/` IS committed — GitHub Pages serves the site from the
// repository, so an asset that is not committed is not on the site.
//
// ---------------------------------------------------------------------------
// What this is solving
//
// The camera file is 4096x2160 with a letterbox burned into the picture. The
// real image is 4096x1540 starting at y=310 — 2.66:1.
//
// On a desktop that is fine. On a phone the frame is about 9:16, which keeps
// roughly a fifth of the width, and a wide shot then lands on whatever happens
// to be in the middle: at 116s that is a fridge, at 24s it is the wall beside
// a pair of hands. Length was never the problem; framing was.
//
// So the phone version is a genuine vertical re-edit. `crops.json` holds a
// horizontal window for each of the film's 38 shots, chosen by rendering the
// window and looking at it — nine of the first estimates were wrong, and one
// of them framed the brand name on a flour bag instead of the almonds being
// grated over a pastry.
//
// The window moves inside a single pass, using an expression on crop's x.
// An earlier version cut 38 clips and concatenated them, and came out 1.55s
// longer than the source: one duplicated frame per cut, because -t includes
// the boundary frame. One pass has no boundaries to round.
//
// setsar=1 is not decoration either. Without it ffmpeg keeps the source's
// display ratio by giving the output non-square pixels (1376:1375), and the
// browser then reports the desktop cut as 1601 wide.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FILM = join(ROOT, 'Film', 'LONG V1.mp4');
const OUT = join(ROOT, 'media');

const ACTIVE_W = 4096, ACTIVE_H = 1540, ACTIVE_Y = 310;
const WIN = Math.round(ACTIVE_H * 9 / 16);   // 866 — a 9:16 window on a 2.66:1 frame
const POSTER_SHOT = 11;                       // Noy's face, centred and still

const shots = JSON.parse(readFileSync(join(HERE, 'crops.json'), 'utf8'));
const ff = a => execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', ...a]);

// if(lt(t,end1), x1, if(lt(t,end2), x2, … xLast))
const xExpr = shots.reduceRight(
  (rest, s, i) => (i === shots.length - 1 ? String(s.x) : `if(lt(t,${s.end}),${s.x},${rest})`), '');

mkdirSync(OUT, { recursive: true });

console.log('desktop cut…');
ff(['-i', FILM, '-an',
  '-vf', `crop=${ACTIVE_W}:${ACTIVE_H}:0:${ACTIVE_Y},scale=1600:-2,setsar=1`,
  '-c:v', 'libx264', '-crf', '26', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-y', join(OUT, 'film-desktop.mp4')]);

console.log(`phone cut, window moving across ${shots.length} shots…`);
ff(['-i', FILM, '-an',
  '-vf', `crop=${WIN}:${ACTIVE_H}:'${xExpr}':${ACTIVE_Y},scale=720:1280,setsar=1`,
  '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-y', join(OUT, 'film-phone.mp4')]);

console.log('posters…');
const p = shots.find(s => s.i === POSTER_SHOT);
const pt = ((p.start + p.end) / 2).toFixed(2);
ff(['-ss', pt, '-i', FILM, '-vframes', '1',
  '-vf', `crop=${ACTIVE_W}:${ACTIVE_H}:0:${ACTIVE_Y},scale=1600:-2,setsar=1`,
  '-q:v', '4', '-y', join(OUT, 'film-poster.jpg')]);
ff(['-ss', pt, '-i', FILM, '-vframes', '1',
  '-vf', `crop=${WIN}:${ACTIVE_H}:${p.x}:${ACTIVE_Y},scale=720:1280,setsar=1`,
  '-q:v', '5', '-y', join(OUT, 'film-poster-phone.jpg')]);

// ---- report, and check the two things that have already gone wrong once ----
const probe = (f, extra = []) => JSON.parse(execFileSync('ffprobe',
  ['-v', 'error', '-select_streams', 'v:0', ...extra,
    '-show_entries', 'stream=width,height,sample_aspect_ratio,nb_read_frames:format=duration,bit_rate',
    '-of', 'json', f], { encoding: 'utf8', maxBuffer: 1 << 26 }));

const src = probe(FILM, ['-count_frames']);
let bad = 0;
console.log('');
for (const name of ['film-desktop.mp4', 'film-phone.mp4']) {
  const f = join(OUT, name);
  const d = probe(f, ['-count_frames']);
  const st = d.streams[0], fm = d.format;
  const mb = (statSync(f).size / 1024 / 1024).toFixed(1);
  console.log(`  ${name}`);
  console.log(`    ${st.width}x${st.height}  sar ${st.sample_aspect_ratio}  ${(+fm.duration).toFixed(2)}s  ${mb}MB  ${(+fm.bit_rate / 1000).toFixed(0)} kbps`);
  console.log(`    30s of watching costs ${((+fm.bit_rate / 8) * 30 / 1024 / 1024).toFixed(1)}MB`);

  if (st.sample_aspect_ratio !== '1:1') { console.log('    FAIL non-square pixels — setsar lost'); bad++; }
  const drift = +st.nb_read_frames - +src.streams[0].nb_read_frames;
  if (drift !== 0) { console.log(`    FAIL ${drift} frames more than the source — a cut is duplicating frames`); bad++; }
}
for (const name of ['film-poster.jpg', 'film-poster-phone.jpg'])
  console.log(`  ${name}  ${(statSync(join(OUT, name)).size / 1024).toFixed(0)}KB`);

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nsquare pixels, and neither cut gained or lost a frame.');
process.exit(bad ? 1 : 0);
