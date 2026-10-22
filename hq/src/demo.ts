import './demo.css';
import {Headquarters, type Mode} from './scene';

// GitHub Pages 静态演示入口：只装配三维场景本身（与线上同一套 Headquarters 与视觉层）。
// 这里不引入 main.ts 的 game shell、会话、实时 SSE 或任何 /api 调用：
// 线上业务流程需要服务端，演示页只承诺“看得见的总部 + 可以走动”。

const world = document.querySelector<HTMLElement>('#world')!;
const status = document.querySelector<HTMLElement>('#load-status')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter')!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];

const hq = new Headquarters(world);
let problem = '';
hq.onError = message => {
  problem = message;
  status.textContent = message;
};

let ready = false;

function setMode(mode: Mode) {
  if (!hq.entered) return;
  hq.setMode(mode);
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
}

enterButton.onclick = () => {
  if (!ready || hq.entered) return;
  hq.enter('visitor', 'pages-demo');
  // 演示直接站到一楼入口内侧，面朝接待大厅；不经过线上服务端的入场/同步流程。
  hq.applyPosition({x:0, y:0, z:10, yaw:0});
  hq.setMode('third');
  enterButton.disabled = true;
  enterButton.textContent = '已进入总部';
  for (const button of modeButtons) button.disabled = false;
  setMode('third');
  status.textContent = '在一楼大厅 · 用 WASD 走动，V 切换视角';
};

for (const button of modeButtons) {
  button.onclick = () => setMode(button.dataset.mode as Mode);
}

// 场景内还支持按 V 在第一/第三人称之间切换；同步按钮高亮，避免界面与实际镜头不一致。
setInterval(() => {
  if (!hq.entered) return;
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === hq.mode));
  }
}, 400);

void (async () => {
  try {
    await hq.load(text => {
      status.textContent = text;
    });
    ready = true;
    status.textContent = problem ? `总部已就绪（部分资源提示：${problem}）` : '总部已就绪 · 点“进入参观”开始走动';
    enterButton.disabled = false;
  } catch (error) {
    status.textContent = `三维总部加载失败：${(error as Error).message}`;
  }
})();
