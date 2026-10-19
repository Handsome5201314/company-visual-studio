import {TextureLoader} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Embedded GLB images use blob URLs. Load them as images under img-src,
// rather than fetching them through the host's stricter connect-src policy.
export function createModelLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new TextureLoader(parser.options.manager).setCrossOrigin(parser.options.crossOrigin).setRequestHeader(parser.options.requestHeader);
  return {name:'HQ_image_textures',afterRoot:async()=>{
   const textures=await parser.getDependencies('texture');
   if(textures.some(texture=>!texture))throw new Error('模型贴图加载失败，请刷新重试');
  }};
 });
 return loader;
}
