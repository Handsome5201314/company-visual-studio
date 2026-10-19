import warm from '../themes/default/theme.json' with {type:'json'};
import cyber from '../themes/cyber/theme.json' with {type:'json'};
export const CONTRACT='hq-fixed-layout-v1';
export const MODEL_IDS=Object.freeze(['chairdesk','computerscreen','plantsmall1','pottedplant','loungedesignsofa','loungedesignchair','tablecoffee','bookcaseopen','books','desk','laptop','kitchencabinet','kitchencoffeemachine']);
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(obj,keys,label)=>{if(!record(obj)||Object.keys(obj).some(k=>!keys.includes(k)))throw new Error(`${label}含不支持的字段`);};
export function assetPath(path){
 if(typeof path!=='string'||!/^furniture\/[a-z0-9][a-z0-9_/-]*\.glb$/.test(path)||path.includes('..')||path.includes('//'))throw new Error('模型必须是仓库内 furniture/ 下的 GLB 相对路径');
 return path;
}
export function validateTheme(input){
 const t=structuredClone(input);
 exact(t,['schemaVersion','id','name','version','author','description','compatibleContract','ui','environment','models','assets','character','architecture'],'主题');
 if(t.architecture===undefined)t.architecture=t.id==='cyber'?'cyber':'warm';
 if(!['warm','cyber'].includes(t.architecture))throw Error('建筑视觉只能使用已经准入的暖木或星港组件');
 if(t.schemaVersion!==1||t.compatibleContract!==CONTRACT)throw new Error('主题布局契约不兼容；不得通过皮肤改变锚点、门禁或碰撞');
 if(!/^[a-z][a-z0-9-]{0,40}$/.test(t.id)||!/^\d+\.\d+\.\d+$/.test(t.version))throw new Error('主题ID或版本错误');
 for(const key of ['name','author','description'])if(typeof t[key]!=='string'||t[key].length<1||t[key].length>200)throw new Error(`主题${key}错误`);
 const uiKeys=['paper','ink','muted','accent','line','error','horizon'];exact(t.ui,[...uiKeys,'font'],'界面');
 if(uiKeys.some(k=>!color(t.ui[k]))||t.ui.font!=='system')throw new Error('界面仅接受六位颜色与system字体');
 const envKeys=['background','sky','ground','sunColor','fillColor'];
 exact(t.environment,[...envKeys,'ambient','sun','fill','exposure','palette'],'环境');
 if(envKeys.some(k=>!color(t.environment[k])))throw new Error('环境颜色错误');
 for(const key of ['ambient','sun','fill','exposure'])if(!Number.isFinite(t.environment[key])||t.environment[key]<0||t.environment[key]>8)throw new Error('灯光或曝光超出0–8范围');
 if(!record(t.environment.palette)||Object.entries(t.environment.palette).some(([k,v])=>!color(k)||!color(v)))throw new Error('材质调色表错误');
 exact(t.models,MODEL_IDS,'家具');
 if(!Array.isArray(t.assets)||t.assets.length>100||new Set(t.assets).size!==t.assets.length)throw new Error('资源清单错误');
 for(const path of t.assets)assetPath(path);
 for(const path of Object.values(t.models)){assetPath(path);if(!t.assets.includes(path))throw new Error('替换模型必须列入assets');}
 if(!['sage','cobalt'].includes(t.character))throw new Error('角色皮肤不支持');
 return t;
}
export const DEFAULT_THEME=validateTheme(warm);
export const THEMES=Object.freeze([DEFAULT_THEME,validateTheme(cyber)]);
export function applyUITheme(element,input){const t=validateTheme(input);for(const k of ['paper','ink','muted','accent','line','error','horizon'])element.style.setProperty('--'+k,t.ui[k]);element.dataset.uiTheme=t.id;}
const SKINS={sage:{'#708c7b':'#708c7b','#e6d4ae':'#e6d4ae'},cobalt:{'#708c7b':'#466c9b','#e6d4ae':'#8faec5'}};
export function applyCharacterSkin(root,skin){
 if(!SKINS[skin])throw new Error('角色皮肤不支持');
 root.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material].flat()){if(!m.color)continue;const base=m.userData.characterColor ||= '#'+m.color.getHexString();if(SKINS[skin][base])m.color.set(SKINS[skin][base]);}});
}
