// Experimental spatial contract, in metres. Never imported by the live world,
// employee engine or MCP server. A reviewed host migration is still required.
export const REVISION = 'warm-hq-detail-20261021-v2';
export const LEVEL_HEIGHT = 4.2;
export const RADIUS = .28;
export const BOUNDS = Object.freeze({minX:-14.7,maxX:14.7,minZ:-11.7,maxZ:11.7});
export const SPAWN = Object.freeze({x:0,y:0,z:10.6});
export const STAIR = Object.freeze({minZ:-1.4,maxZ:3.4,landingBack:-3.4,left:[5.1,7.6],right:[8.4,10.9],steps:16});
export const FLOOR_NAMES = ['接待与展示层','创作与项目层','管理与协作层'];
const rect=(id,minX,maxX,minZ,maxZ,y)=>({id,minX,maxX,minZ,maxZ,y});
export const SURFACES = [];
for(let floor=0;floor<3;floor++){
 const y=floor*LEVEL_HEIGHT;
 SURFACES.push(rect(`west-${floor}`,-14.7,-3.5,-11.7,11.7,y),rect(`east-${floor}`,3.5,14.7,-11.7,11.7,y),rect(`back-${floor}`,-3.5,3.5,-11.7,-3.4,y));
 SURFACES.push(rect(`front-${floor}`,-3.5,3.5,3.4,floor===0?11.7:5.8,y));
 if(floor<2){
  SURFACES.push({...rect(`up-${floor}`,STAIR.left[0],STAIR.left[1],STAIR.minZ,STAIR.maxZ,y),ramp:'up'});
  SURFACES.push(rect(`landing-${floor}`,STAIR.left[0],STAIR.right[1],STAIR.landingBack,STAIR.minZ,y+LEVEL_HEIGHT/2));
  SURFACES.push({...rect(`return-${floor}`,STAIR.right[0],STAIR.right[1],STAIR.minZ,STAIR.maxZ,y+LEVEL_HEIGHT/2),ramp:'return'});
 }
}
// Mirrors sample furniture, not production access control. The CEO room is a
// closed blockout: neither role simulation nor client-side ownership checks.
export const OBSTACLES = [
 {id:'reception',x:-6.8,z:7.2,w:5.6,d:1.12,y:0},
 {id:'reception-backdrop',x:-6.8,z:6,w:6.1,d:.22,y:0},
 {id:'gallery-plinth',x:-14.20,z:2.1,w:.42,d:9.6,y:0},
 {id:'lounge',x:11.25,z:7.1,w:4.2,d:1.25,y:0},
 {id:'lounge-table',x:11.1,z:9,w:1.44,d:1.44,y:0},
 {id:'meeting-block',x:10,z:-6.6,w:6,d:6,y:0},
 {id:'ceo-block',x:10,z:-7,w:6,d:7,y:8.4},
];
for(const y of [4.2,8.4])for(const x of [-10,-6.5,6.5,10])for(const z of [-.2,6.6])OBSTACLES.push({id:`desk-${x}-${z}-${y}`,x,z,w:2.8,d:1.35,y});
for(const y of [0,4.2,8.4])for(const x of [-14.7,-3.5,3.5,14.7])for(const z of [-11.7,11.7])OBSTACLES.push({id:`column-${x}-${z}-${y}`,x,z,w:.28,d:.28,y});
for(const y of [4.2,8.4])for(const x of [-4.25,4.25])for(const z of [-8,2,9.8])OBSTACLES.push({id:`planter-${x}-${z}-${y}`,x,z,w:.65,d:.65,y});
for(const x of [-10.15,-3.45])OBSTACLES.push({id:`reception-planter-${x}`,x,z:6.05,w:.88,d:.88,y:0});
for(const[x,z]of [[13.7,9.7],[3.9,9.8],[-13.7,-10.5],[4.4,3.9],[11.6,3.9]])OBSTACLES.push({id:`lobby-planter-${x}-${z}`,x,z,w:.84,d:.84,y:0});
export function supportAt(x,z,y){
 if(![x,z,y].every(Number.isFinite))return null;
 if(x<BOUNDS.minX||x>BOUNDS.maxX||z<BOUNDS.minZ||z>BOUNDS.maxZ)return null;
 const candidates=[];
 for(const s of SURFACES){
  const inset=s.ramp?RADIUS:0;
  if(x<s.minX+inset||x>s.maxX-inset||z<s.minZ-1e-7||z>s.maxZ+1e-7)continue;
  if(s.y>0&&(z>-3.4&&z<3.4||z>5.8)&&((s.id.startsWith('west-')&&x>-3.5-RADIUS)||(s.id.startsWith('east-')&&x<3.5+RADIUS)))continue;
  if(s.id.startsWith('front-')&&s.y>0&&Math.abs(x)<3.5&&z>5.8-RADIUS)continue;
  if(s.id.startsWith('landing-')&&(x<STAIR.left[0]+RADIUS||x>STAIR.right[1]-RADIUS||z<STAIR.landingBack+RADIUS))continue;
  const h=s.ramp?s.y+(s.ramp==='up'?(3.4-z)/4.8:(z+1.4)/4.8)*LEVEL_HEIGHT/2:s.y;
  if(Math.abs(h-y)<=.16)candidates.push({y:h,surface:s.id,priority:s.ramp?1:0});
 }
 // A stair/ramp must own its footprint even while it overlaps a floor slab.
 // Otherwise the flat slab always wins near the first step and the walker can
 // never accumulate height into the ramp's steep middle section.
 candidates.sort((a,b)=>b.priority-a.priority||Math.abs(a.y-y)-Math.abs(b.y-y));
 return candidates[0]||null;
}
export function collides(x,y,z){return OBSTACLES.some(o=>Math.abs(o.y-y)<.3&&Math.abs(x-o.x)<o.w/2+RADIUS&&Math.abs(z-o.z)<o.d/2+RADIUS);}
export function advance(position,dx,dz){
 if(![position.x,position.y,position.z,dx,dz].every(Number.isFinite))throw new TypeError('Position and movement must be finite');
 const steps=Math.ceil(Math.hypot(dx,dz)/.06)||1;
 const result={...position};
 for(let i=0;i<steps;i++){
  const x=result.x+dx/steps,z=result.z+dz/steps;
  const support=supportAt(x,z,result.y);
  if(!support||collides(x,support.y,z))return result;
  result.x=x;result.y=support.y;result.z=z;
 }
 return result;
}
// A real continuous route, used by the walkthrough and swept-path tests.
export const WALK_ROUTE = [
 [0,4.8],[4.2,4.8],[6.35,4.4],[6.35,3.4],[6.35,-2.4],[9.65,-2.4],[9.65,4.8],
 [6.35,4.8],[6.35,3.4],[6.35,-2.4],[9.65,-2.4],[9.65,4.8],[4.5,4.8],
];
