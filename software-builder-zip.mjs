import { readdir, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

// Produces standards-compliant ZIP32 archives without a paid service or extra npm dependency.
const table = Array.from({length:256}, (_, n) => { let c=n; for(let k=0;k<8;k++) c=(c>>>1) ^ ((c&1) ? 0xedb88320 : 0); return c>>>0; });
function crc32(buf) { let c=0xffffffff; for(const b of buf) c=table[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
const excludedDirs = new Set(["node_modules",".git",".venv","venv","__pycache__", ".next",".cache"]);
const deniedFiles = [/^\.env(?:\.|$)/i, /^\.npmrc$/i, /^\.pypirc$/i, /^id_(?:rsa|ed25519)/i, /^credentials(?:\.|$)/i, /^secret(?:s)?(?:\.|$)/i];
export async function collectProjectFiles(root, {maxFiles=2000,maxBytes=70*1024*1024}={}) {
  const files=[]; let total=0;
  async function visit(dir, relative="") {
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      if (entry.isSymbolicLink()) continue; // Do not follow symlinks out of the isolated project.
      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) await visit(path.join(dir,entry.name),path.posix.join(relative,entry.name));
        continue;
      }
      if (!entry.isFile() || deniedFiles.some(r=>r.test(entry.name))) continue;
      const relativePath=path.posix.join(relative,entry.name);
      if (!relativePath || relativePath.startsWith("/") || relativePath.split("/").includes("..")) continue;
      const full=path.join(dir,entry.name);
      const st=await lstat(full);
      if (!st.isFile() || st.size>maxBytes || (total+=st.size)>maxBytes || files.length>=maxFiles) throw Error("Project too large to package safely (70 MB / 2,000 files limit).");
      files.push({name:relativePath, data:await readFile(full)});
    }
  }
  await visit(root); return files;
}
export function zipBuffers(files) {
  const local=[],central=[];let offset=0;
  for(const file of files) {
    const filename=String(file.name);
    if (!filename || filename.startsWith("/") || filename.includes("\\") || filename.split("/").some(p=>!p||p==="."||p==="..")) throw Error("Unsafe ZIP filename");
    const name=Buffer.from(filename,"utf8"),body=Buffer.from(file.data),compressed=deflateRawSync(body);
    if(name.length>65535||body.length>0xffffffff||compressed.length>0xffffffff) throw Error("ZIP entry exceeds format limits");
    const crc=crc32(body);
    const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x800,6);lh.writeUInt16LE(8,8);
    lh.writeUInt32LE(crc,14);lh.writeUInt32LE(compressed.length,18);lh.writeUInt32LE(body.length,22);lh.writeUInt16LE(name.length,26);
    local.push(lh,name,compressed);
    const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x800,8);ch.writeUInt16LE(8,10);
    ch.writeUInt32LE(crc,16);ch.writeUInt32LE(compressed.length,20);ch.writeUInt32LE(body.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);
    central.push(ch,name);offset+=lh.length+name.length+compressed.length;
  }
  if(files.length>65535) throw Error("Too many ZIP entries");
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,cd,end]);
}
