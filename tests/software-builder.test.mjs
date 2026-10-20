import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inflateRawSync } from "node:zlib";
import { collectProjectFiles, zipBuffers, validateProjectArtifact } from "../software-builder-zip.mjs";

test("ZIP emits valid local entries, central directory and original bytes", () => {
  const files=[{name:"README.md",data:Buffer.from("hello world")},{name:"src/main.py",data:Buffer.from("print('ok')\n")}];
  const zip=zipBuffers(files);
  let pos=0;
  for(const f of files) {
    assert.equal(zip.readUInt32LE(pos),0x04034b50);
    const nameLen=zip.readUInt16LE(pos+26);
    const extraLen=zip.readUInt16LE(pos+28);
    const compressed=zip.readUInt32LE(pos+18);
    const name=zip.subarray(pos+30,pos+30+nameLen).toString();
    assert.equal(name,f.name);
    const start=pos+30+nameLen+extraLen;
    assert.deepEqual(inflateRawSync(zip.subarray(start,start+compressed)),f.data);
    pos=start+compressed;
  }
  assert.equal(zip.readUInt32LE(pos),0x02014b50);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length-22+10),2);
});
test("ZIP blocks path traversal entries",()=>{
  assert.throws(()=>zipBuffers([{name:"../private.env",data:"secret"}]),/Unsafe ZIP/);
  assert.throws(()=>zipBuffers([{name:"x\\evil.js",data:"x"}]),/Unsafe ZIP/);
});
test("project collector omits node_modules, .env and external symlinks",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"junior-builder-"));
 try{
   await mkdir(path.join(root,"src"));
   await mkdir(path.join(root,"node_modules"));
   await writeFile(path.join(root,"src","main.py"),"print('safe')");
   await writeFile(path.join(root,".env"),"PRIVATE=secret");
   await writeFile(path.join(root,"node_modules","ignored.txt"),"ignore");
   await writeFile(path.join(root,"readme.txt"),"safe");
   try{await symlink(path.join(root,".env"),path.join(root,"link-to-env"));}catch{} // Windows symlink creation may need extra privileges.
   const files=await collectProjectFiles(root);
   assert.deepEqual(files.map(f=>f.name).sort(),["readme.txt","src/main.py"]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("project collector imposes size limit",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"junior-builder-limit-"));
 try {
  await writeFile(path.join(root,"big.bin"),Buffer.alloc(100));
  await assert.rejects(()=>collectProjectFiles(root,{maxBytes:50}),/too large/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test("builder never accepts a WSL probe as completed software", async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),"junior-probe-"));
  try {
    await writeFile(path.join(root,".junior-wsl-write-check"),"ok");
    const files=await collectProjectFiles(root);
    assert.deepEqual(files,[]);
    const result=validateProjectArtifact(files,"WHISPER OVERNIGHT");
    assert.equal(result.valid,false);
    assert.ok(result.issues.includes("missing Python backend"));
    assert.ok(result.issues.includes("missing React frontend"));
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("Whisper artifacts require actual backend, React source and README",()=>{
  const file=name=>({name,data:Buffer.from("code")});
  assert.equal(validateProjectArtifact([file("backend/main.py"),file("README.md")],"WHISPER OVERNIGHT").valid,false);
  assert.equal(validateProjectArtifact([file("backend/main.py"),file("frontend/src/App.jsx"),file("README.md")],"WHISPER OVERNIGHT").valid,true);
  assert.equal(validateProjectArtifact([file("hello.py"),file("README.md")],"hello world").valid,true);
});
