export function inspectGLB(input){
 const bytes=new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.byteLength>10*1024*1024||bytes.byteLength<20)throw new Error('GLB须在20字节至10MB之间');
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw new Error('不是完整的GLB 2.0文件');
 const length=view.getUint32(12,true);if(view.getUint32(16,true)!==0x4e4f534a||length>bytes.length-20)throw new Error('GLB缺少有效JSON块');
 const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+length)));
 if([...json.buffers||[],...json.images||[]].some(item=>item.uri))throw new Error('请导出纹理和缓冲内嵌的GLB，不接受外部资源URL');
 if((json.nodes?.length||0)>1000||(json.meshes?.length||0)>500)throw new Error('节点或网格过多，请先精简模型');
 const vertices=(json.accessors||[]).reduce((sum,a)=>sum+(a.type==='VEC3'?a.count||0:0),0);
 if(vertices>1500000)throw new Error('模型数据量过大，请先减面');
 return {json,nodes:json.nodes?.length||0,meshes:json.meshes?.length||0,skins:json.skins?.length||0,clips:(json.animations||[]).map(a=>a.name||'未命名')};
}
