import {createDecorationEditor} from '../../src/decoration-editor';
document.body.style.cssText='margin:0;padding:24px;background:#fbf5e8;color:#293c30;font:14px/1.75 "Microsoft YaHei",sans-serif';
const host=document.getElementById('editor')!;const editor=createDecorationEditor(host);window.addEventListener('pagehide',()=>editor.dispose(),{once:true});
