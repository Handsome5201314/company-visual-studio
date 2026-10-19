// Synthetic data is deliberately confined to the showroom. The host never imports this file.
export function previewAPI(role:'anonymous'|'author'='anonymous'){
 return async function api<R>(path:string,method='GET',_data?:unknown):Promise<R>{
  if(method!=='GET')throw new Error('这是展厅演示；账号、保存、审批和授权操作不会发送至真实公司');
  let result:unknown;
  if(path==='/auth/me')result={account:role==='author'?{id:'demo-author',displayName:'示例写手（演示）',role:'author'}:null,setupRequired:false,localSetupAllowed:false};
  else if(path==='/articles/demo-article')result={id:'demo-article',authorId:'demo-author',slug:'demo',title:'工作室装修提案（演示）',body:'这是一份仅用于检验编辑器排版的示例。请描述家具、灯光和色彩的修改。',category:'stories',sources:[],mediaIds:[],version:1,updatedAt:'2026-10-19T00:00:00Z',submittedRevisionId:null,submittedVersion:null,publishedRevisionId:null};
  else if(path==='/employee')result={employee:{id:'demo-employee',accountId:'demo-author',mode:'manual',controlEpoch:1,bindingId:null,workspace:null,position:{x:-5,y:0,z:5.8},running:[]},bindings:[]};
  else if(path==='/articles')result={items:[]};
  else throw new Error('展厅未实现该业务请求：'+path+'；请在真实公司中验证');
  return structuredClone(result) as R;
 };
}
