// Authoritative spatial contract, in metres. The scene, navigation service,
// employee engine and MCP host all consume this module.
export const LAYOUT_REVISION = 4;
export const HOST_LAYOUT_REVISION = LAYOUT_REVISION;
export const FLOOR_HEIGHT = 4.2;
export const WORLD_BOUNDS = Object.freeze({minX:-28,maxX:28,minZ:-18,maxZ:38});
export const BOUNDS = WORLD_BOUNDS;
export const BUILDING_BOUNDS = Object.freeze({minX:-14.7,maxX:14.7,minZ:-11.7,maxZ:11.7});
export const SPAWN = Object.freeze({x:0,y:0,z:30});
export const RECEPTION = Object.freeze({x:-5.8,z:7.2});
export const ENTRANCE = Object.freeze({minX:-2.2,maxX:2.2,z:11.7});
export const FLOOR_NAMES = Object.freeze(['接待与展示层','创作与项目层','管理与协作层']);
export const STAIR = Object.freeze({
  minZ:-1.4,maxZ:3.4,landingBack:-3.4,left:[5.1,7.6],right:[8.4,10.9],steps:16,
});
export const OWNER_OFFICE = Object.freeze({
  minX:3,maxX:BUILDING_BOUNDS.maxX,minZ:BUILDING_BOUNDS.minZ,maxZ:-3.35,
  floor:2,y:2*FLOOR_HEIGHT,doorX:3,doorZMin:-5.6,doorZMax:-4.4,
});
export const WORKSTATIONS = Object.freeze([
  {x:-10,z:1,floor:1},
  {x:-10,z:1,floor:2},
]);

const floorSurfaces = [];
for (let floor=0; floor<3; floor+=1) {
  const y=floor*FLOOR_HEIGHT;
  floorSurfaces.push(
    {floor,id:`west-${floor}`,minX:BUILDING_BOUNDS.minX,maxX:-3.5,minZ:BUILDING_BOUNDS.minZ,maxZ:BUILDING_BOUNDS.maxZ,y,kind:'slab'},
    {floor,id:`east-${floor}`,minX:3.5,maxX:BUILDING_BOUNDS.maxX,minZ:BUILDING_BOUNDS.minZ,maxZ:BUILDING_BOUNDS.maxZ,y,kind:'slab'},
    {floor,id:`back-${floor}`,minX:-3.5,maxX:3.5,minZ:BUILDING_BOUNDS.minZ,maxZ:-3.4,y,kind:'slab'},
    {floor,id:`front-${floor}`,minX:-3.5,maxX:3.5,minZ:3.4,maxZ:floor===0?BUILDING_BOUNDS.maxZ:5.8,y,kind:'slab'},
  );
  if(floor===0)floorSurfaces.push({floor,id:'center-0',minX:-3.5,maxX:3.5,minZ:-3.4,maxZ:3.4,y,kind:'slab'});
}
export const SURFACES = Object.freeze(floorSurfaces);

// Furniture and wall volumes share the scene's centre line, stair footprint and
// owner-office door. Collision is enforced; these records never grant access.
export const OBSTACLES = Object.freeze([
  {id:'reception',x:-5.8,z:7.2,w:6.06,d:1.96,y:0},
  {id:'reception-backdrop',x:-5.8,z:6,w:6.4,d:.2,y:0},
  {id:'gallery-wall',x:-14.2,z:2.1,w:.42,d:9.6,y:0},
  {id:'lobby-sofa',x:11.2,z:6.05,w:4.7,d:1.65,y:0},
  {id:'lobby-table',x:11.2,z:8.9,w:1.5,d:1.5,y:0},
  {id:'lobby-bookcase',x:14.16,z:1.8,w:.45,d:2.5,y:0},
  {id:'lobby-bench-sofa',x:-10.8,z:10.1,w:4.7,d:1.65,y:0},
  {id:'lobby-bench-table',x:-10.8,z:8.25,w:1.5,d:1.5,y:0},
  {id:'meeting-wall-front-left',x:7.15,z:-3.5,w:2.05,d:.18,y:0,margin:.05},
  {id:'meeting-wall-front-right',x:13.05,z:-3.5,w:2.05,d:.18,y:0,margin:.05},
  {id:'meeting-wall-west',x:7,z:-6.7,w:.18,d:6.4,y:0,margin:.05},
  {id:'meeting-wall-east',x:13.2,z:-6.7,w:.18,d:6.4,y:0,margin:.05},
  {id:'meeting-wall-back',x:10.1,z:-9.9,w:6.2,d:.18,y:0,margin:.05},
  {id:'owner-office-front-wall',x:8.85,z:-3.35,w:11.7,d:.18,y:8.4,margin:.04},
  {id:'owner-office-west-wall-back',x:3,z:-8.65,w:.18,d:6.1,y:8.4,margin:.04},
  {id:'owner-office-west-wall-front',x:3,z:-3.875,w:.18,d:1.05,y:8.4,margin:.04},
  {id:'owner-desk',x:10,z:-7,w:3.8,d:1.35,y:8.4},
  {id:'owner-bookcase-west',x:3.55,z:-9.55,w:.45,d:3.3,y:8.4},
  {id:'owner-sofa',x:11.7,z:-4.65,w:1.45,d:3.3,y:8.4},
  {id:'second-floor-collaboration-table',x:-9.2,z:-4.8,w:4.3,d:1.35,y:4.2},
  {id:'third-floor-management-table',x:-9.2,z:-4.7,w:4.4,d:1.42,y:8.4},
  ...[1,2].flatMap(floor=>[-.3,6.5].flatMap((z,row)=>[-10,-6.5,6.5,10].map((x,column)=>
    ({id:`staff-desk-${floor}-${row}-${column}`,x,z,w:2.8,d:1.35,y:floor*FLOOR_HEIGHT})))),
  {id:'lobby-planter-a',x:7.72,z:2.68,w:.84,d:.84,y:0},
  {id:'lobby-planter-b',x:9.15,z:2.68,w:.84,d:.84,y:0},
  {id:'lobby-planter-c',x:11.6,z:3.9,w:.84,d:.84,y:0},
  {id:'lobby-planter-d',x:13.75,z:10.75,w:.84,d:.84,y:0},
  {id:'lobby-planter-e',x:2.85,z:10.35,w:.84,d:.84,y:0},
]);

// Compatibility export retained for the v1 decoration contract. These legacy
// volumes are no longer part of the live collision set.
export const LOBBY_PARTITION_OBSTACLES = Object.freeze([]);
export const DECORATION_ANCHORS = Object.freeze([
  {id:'reception-counter',x:-5,z:1,w:3.2,d:.7,y:0},
  {id:'work-counter-a',x:4.5,z:-.7,w:5.2,d:1,y:0},
  {id:'work-counter-b',x:4.5,z:2.2,w:5.2,d:1,y:0},
  {id:'library',x:8.575,z:5.5,w:.95,d:2.8,y:0},
  {id:'owner-counter',x:6,z:-5.8,w:3.4,d:.9,y:4.2},
  {id:'meeting-counter',x:6,z:5.9,w:2.2,d:.9,y:0},
  {id:'lounge-inside',x:-7.7,z:-4.6,w:1.2,d:3.6,y:0},
]);

export function containsObstacle(obstacle,x,y,z){
  const margin=obstacle.margin??.26;
  return Math.abs(obstacle.y-y)<.3
    && Math.abs(x-obstacle.x)<obstacle.w/2+margin
    && Math.abs(z-obstacle.z)<obstacle.d/2+margin;
}

function insideBuilding(x,z){
  return x>=BUILDING_BOUNDS.minX&&x<=BUILDING_BOUNDS.maxX&&z>=BUILDING_BOUNDS.minZ&&z<=BUILDING_BOUNDS.maxZ;
}

export function isOwnerOffice(x,z,floor){
  return floor===OWNER_OFFICE.floor&&Number.isFinite(x)&&Number.isFinite(z)
    &&x>=OWNER_OFFICE.minX&&x<=OWNER_OFFICE.maxX&&z>=OWNER_OFFICE.minZ&&z<=OWNER_OFFICE.maxZ;
}

function stairCandidates(x,z){
  const result=[];
  for(let base=0;base<2;base+=1){
    const y0=base*FLOOR_HEIGHT;
    const up=STAIR.left,returnRun=STAIR.right;
    if(x>=up[0]&&x<=up[1]&&z>=STAIR.minZ&&z<=STAIR.maxZ){
      const y=y0+(STAIR.maxZ-z)/(STAIR.maxZ-STAIR.minZ)*(FLOOR_HEIGHT/2);
      result.push({floor:base,y,surfaceId:`stair-up-${base}`,kind:'ramp',priority:2});
    }
    if(x>=STAIR.left[0]&&x<=STAIR.right[1]&&z>=STAIR.landingBack&&z<=STAIR.minZ){
      result.push({floor:base,y:y0+FLOOR_HEIGHT/2,surfaceId:`stair-landing-${base}`,kind:'landing',priority:2});
    }
    if(x>=returnRun[0]&&x<=returnRun[1]&&z>=STAIR.minZ&&z<=STAIR.maxZ){
      const y=y0+FLOOR_HEIGHT/2+(z-STAIR.minZ)/(STAIR.maxZ-STAIR.minZ)*(FLOOR_HEIGHT/2);
      result.push({floor:base,y,surfaceId:`stair-return-${base}`,kind:'ramp',priority:2});
    }
  }
  return result;
}

export function supportAt(x,z,preferredY=0){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(preferredY))return null;
  if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ)return null;
  if(!insideBuilding(x,z)){
    const kind=z>=28&&z<=34?'road':z>=ENTRANCE.z?'walkway':'grass';
    return Math.abs(preferredY)<=.24?{floor:0,y:0,surfaceId:kind,kind}:null;
  }
  const candidates=[];
  const insideStairFootprint=x>=STAIR.left[0]&&x<=STAIR.right[1]&&z>=STAIR.landingBack&&z<=STAIR.maxZ;
  for(const s of SURFACES){
    if(!insideStairFootprint&&x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ&&Math.abs(s.y-preferredY)<=.16){
      candidates.push({floor:s.floor,y:s.y,surfaceId:s.id,kind:s.kind,priority:0});
    }
  }
  for(const s of stairCandidates(x,z)){
    if(Math.abs(s.y-preferredY)<=.24)candidates.push(s);
  }
  candidates.sort((a,b)=>b.priority-a.priority||Math.abs(a.y-preferredY)-Math.abs(b.y-preferredY));
  const found=candidates[0];
  return found?{floor:found.floor,y:found.y,surfaceId:found.surfaceId,kind:found.kind}:null;
}

export function floorHeight(x,z,preferredY=0){
  return supportAt(x,z,preferredY)?.y??0;
}

export function canAccessPosition(role,x,z,floor){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(floor)||floor<0||floor>2)return false;
  if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ)return false;
  if(role!=='owner'&&role!=='visitor')return false;
  return role==='owner'||!isOwnerOffice(x,z,floor);
}

function crossesOfficeDoor(fromX,fromZ,x,z,fromFloor,toFloor){
  if(fromFloor!==2||toFloor!==2)return true;
  if(!Number.isFinite(fromX)||!Number.isFinite(fromZ))return false;
  const wasInside=isOwnerOffice(fromX,fromZ,2),isInside=isOwnerOffice(x,z,2);
  if(wasInside===isInside)return true;
  if(!((fromX<OWNER_OFFICE.doorX&&x>=OWNER_OFFICE.doorX)||(fromX>=OWNER_OFFICE.doorX&&x<OWNER_OFFICE.doorX)))return false;
  const dx=x-fromX;
  if(dx===0)return false;
  const t=(OWNER_OFFICE.doorX-fromX)/dx;
  if(t<0||t>1)return false;
  const crossingZ=fromZ+(z-fromZ)*t;
  return crossingZ>=OWNER_OFFICE.doorZMin-1e-9&&crossingZ<=OWNER_OFFICE.doorZMax+1e-9;
}

function crossesEntrance(fromX,fromZ,x,z,fromFloor,toFloor){
  if(fromFloor!==0||toFloor!==0)return false;
  if((fromX<ENTRANCE.minX||fromX>ENTRANCE.maxX)&&(x<ENTRANCE.minX||x>ENTRANCE.maxX))return false;
  if(fromX<ENTRANCE.minX&&x>ENTRANCE.maxX)return false;
  if(fromX>ENTRANCE.maxX&&x<ENTRANCE.minX)return false;
  const crossesFront=(fromZ<ENTRANCE.z&&z>=ENTRANCE.z)||(fromZ>=ENTRANCE.z&&z<ENTRANCE.z);
  return crossesFront&&x>=ENTRANCE.minX&&x<=ENTRANCE.maxX;
}

// Optional fromSupport is the floor/surface identity of the current point.
export function canMove(x,z,fromY,role='visitor',fromX,fromZ,fromSupport){
  if(![x,z,fromY].every(Number.isFinite))return false;
  if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ)return false;
  const target=supportAt(x,z,fromY);
  if(!target)return false;
  if(!canAccessPosition(role,x,z,target.floor))return false;
  let from=fromSupport;
  if(!from&&Number.isFinite(fromX)&&Number.isFinite(fromZ))from=supportAt(fromX,fromZ,fromY);
  if(!from)return false;
  if(Math.abs(target.y-fromY)>.24)return false;
  if(from.floor!==target.floor&&from.kind!=='ramp'&&from.kind!=='landing'&&target.kind!=='ramp'&&target.kind!=='landing')return false;
  if(OBSTACLES.some(o=>containsObstacle(o,x,target.y,z)))return false;
  if(role==='owner'&&!crossesOfficeDoor(fromX,fromZ,x,z,from.floor,target.floor))return false;
  if(insideBuilding(fromX,fromZ)!==insideBuilding(x,z)){
    if(!crossesEntrance(fromX,fromZ,x,z,from.floor,target.floor))return false;
  }
  return true;
}
