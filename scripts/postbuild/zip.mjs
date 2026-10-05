// npm run zip → spadunyasi-dist.zip with the CONTENTS of dist/ at the zip root (TES-01), dotfiles included
// (.htaccess). Minimal ZIP writer on node:zlib (deflate + crc32) — no extra dependency.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { deflateRawSync, crc32 } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'spadunyasi-dist.zip');

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (!/^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(e.name)) out.push(p);
  }
  return out;
}

function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

const files = (await walk(DIST)).sort();
const locals = [];
const centrals = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(path.relative(DIST, f).split(path.sep).join('/'), 'utf8');
  const data = await readFile(f);
  const st = await stat(f);
  const { time, date } = dosTime(st.mtime);
  const crc = crc32(data) >>> 0;
  // Already-compressed formats are stored; text is deflated.
  const store = /\.(avif|webp|jpe?g|png|woff2|ico|zip)$/i.test(f);
  const body = store ? data : deflateRawSync(data, { level: 9 });
  const method = store ? 0 : 8;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, body);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x031e, 4); // made by: UNIX, v3.0 (keeps permission bits)
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(date, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(((0o100644 << 16) >>> 0), 38); // -rw-r--r-- (cPanel: files 644)
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);
  offset += local.length + name.length + body.length;
}
const centralBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
if (files.length > 0xffff || offset > 0xffffffff) throw new Error('zip too large for the simple writer (ZIP64 needed)');
await writeFile(OUT, Buffer.concat([...locals, centralBuf, end]));
console.log(`spadunyasi-dist.zip: ${files.length} files, ${((offset + centralBuf.length + 22) / 1024 / 1024).toFixed(1)} MB`);
