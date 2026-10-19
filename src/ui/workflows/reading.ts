type Api=<T>(path:string,method?:string,data?:unknown)=>Promise<T>;
export async function trackReading({api,slug,article,status,alive}:{api:Api;slug:string;article:HTMLElement;status:HTMLElement;alive:()=>boolean}){
 let stopped=false,pending=false,token='',visible=false,timer:ReturnType<typeof setInterval>|undefined;
 const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);void tick();});
 const active=()=>alive()&&!stopped&&!document.hidden&&document.hasFocus()&&visible;
 async function tick(){if(!token||pending||stopped||!alive())return;pending=true;try{const r=await api<{qualified:boolean;excluded?:boolean}>('/public/reading/heartbeat','POST',{token,active:active()});if(alive())status.textContent=r.excluded?'作者与老板自读不计入有效阅读。':r.qualified?'本次已达到有效阅读条件；同一账号或浏览器对同篇去重。':'正文在前台累计阅读10秒后计入有效阅读。';}catch(e){if(alive())status.textContent='有效阅读计数已暂停：'+(e as Error).message;stop();}finally{pending=false;}}
 const change=()=>void tick();
 function stop(){if(stopped)return;stopped=true;clearInterval(timer);observer.disconnect();document.removeEventListener('visibilitychange',change);window.removeEventListener('blur',change);window.removeEventListener('focus',change);if(token)void api('/public/reading/heartbeat','POST',{token,active:false}).catch(e=>console.info('阅读结束信号未送达：'+(e as Error).message));}
 try{const r=await api<{token:string;intervalMs:number}>('/public/articles/'+encodeURIComponent(slug)+'/reading','POST',{});token=r.token;if(!alive()){stop();return stop;}observer.observe(article);document.addEventListener('visibilitychange',change);window.addEventListener('blur',change);window.addEventListener('focus',change);timer=setInterval(()=>void tick(),r.intervalMs);}catch(e){if(alive())status.textContent='有效阅读计数未启动：'+(e as Error).message;stop();}
 return stop;
}
