import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyPackage} from '../tools/theme-package.mjs';
test('package reader rejects an oversized manifest before decoding its JSON',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'theme-limit-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=await open(join(dir,'theme-package.json'),'w');try{await file.truncate(1024*1024+1);}finally{await file.close();}
 await assert.rejects(verifyPackage(dir),/清单超过1MiB/);
});
