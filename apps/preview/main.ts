import {createDecorationEditor} from '../../src/decoration-editor';
import {validatePackageManifest} from '../../src/decoration-package.js';
import {validateDecorationSafety} from '../../src/decoration-safety.js';
import {validateTheme} from '../../src/theme.js';
import {sha256Hex} from '../../src/theme-package-export.js';

// This viewer is compiled from the trusted base. Contributor content is JSON,
// self-contained GLB and images only; no package scripts are imported.
document.body.style.cssText='margin:0;padding:16px;background:#fbf5e8;color:#293c30;font:14px/1.6 system-ui';
const status=document.getElementById('preview-status')!;
async function start(){
 const value=new URLSearchParams(location.search).get('package');
 if(!value)throw Error('未指定已校验的主题包目录');
 const base=new URL(value,location.href);if(base.origin!==location.origin||base.search||base.hash||!base.pathname.endsWith('/'))throw Error('只允许同源主题包目录');
 const response=await fetch(new URL('theme-package.json',base));if(!response.ok)throw Error(`清单读取失败 HTTP ${response.status}`);
 const manifest=validatePackageManifest(await response.json()),files=new Map<string,Uint8Array>();
 for(const file of manifest.files){
  const r=await fetch(new URL(file.path,base));if(!r.ok)throw Error(`${file.path} HTTP ${r.status}`);
  const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length!==file.bytes||await sha256Hex(bytes)!==file.sha256)throw Error(`冻结资源字节不一致：${file.path}`);files.set(file.path,bytes);
 }
 const json=(path:string)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files.get(path)));
 const theme=validateTheme(json(manifest.themePath)),scene=validateDecorationSafety(json(manifest.scenePath));
 if(theme.id!==manifest.id||theme.version!==manifest.version)throw Error('主题身份与冻结清单不一致');
 const editor=createDecorationEditor(document.getElementById('preview')!,{theme,scene},{readOnly:true,assetBase:base.href,runtimeAssetBase:new URL('../../',location.href).href});
 status.textContent=`${manifest.name} ${manifest.version} · 实际 3D 只读预览 · 尚未总部审核／上架`;
 window.addEventListener('pagehide',()=>editor.dispose(),{once:true});
}
start().catch(e=>{status.textContent='预览失败：'+e.message;status.setAttribute('role','alert');});
