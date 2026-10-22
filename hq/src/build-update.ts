export function mountBuildUpdate(){
 const current=import.meta.env.VITE_COMPANY_BUILD_ID;
 if(!import.meta.env.PROD||!current)return;
 const button=document.createElement('button');button.className='build-update';button.dataset.buildId=current;button.hidden=true;button.type='button';button.textContent='新版已就绪 · 保存后刷新';
 button.setAttribute('aria-label','新版已就绪，请先保存工作，然后刷新页面');document.querySelector('.top-actions')?.append(button);
 button.onclick=()=>{if(confirm('请确认当前表单和草稿已保存。现在刷新并载入新版？'))location.reload();};
 const controller=new AbortController();
 async function check(){
  if(document.hidden)return;
  try{const response=await fetch('/build-info.json',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!response.ok)return;const version=await response.json();if(typeof version.id==='string'&&version.id!==current)button.hidden=false;}
  catch(error){if(!controller.signal.aborted)console.debug('版本检查暂不可用，将自动重试');}
 }
 const timer=setInterval(()=>void check(),30000);
 window.addEventListener('pagehide',()=>{clearInterval(timer);controller.abort();},{once:true});
}
