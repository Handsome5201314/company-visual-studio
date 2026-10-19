import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildShippedPackage} from '../tools/build-shipped-package.mjs';
test('both original themes build portable packages with real covers, licensed models and fixed source commit',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'shipped-theme-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const id of ['default','cyber']){const r=await buildShippedPackage(id,join(dir,id));assert.equal(r.manifest.id,id);assert.equal(r.theme.assets.length,13);assert.equal(r.manifest.files.find(f=>f.path==='preview.png').bytes>100000,true);assert.match(r.manifest.source.commit,/^[a-f0-9]{40}$/);assert.equal(r.scene.objects.length,0);assert.ok(r.totalBytes<30*1024*1024);assert.ok(r.theme.models.desk.includes(id==='default'?'/warm/':'/cyber/'));assert.equal(r.theme.architecture,id==='cyber'?'cyber':'warm');await assert.rejects(buildShippedPackage(id,join(dir,id)),/EEXIST/);}
});
