import './founder.css';

/**
 * 创始人区块：接的是个人 IP 原型（2026-10-18）里的形象与项目资料。
 * 只使用可公开的肖像、立绘与项目照片；生活照不进站点。
 * 文案只写能从现有素材确认的部分，不编造履历与数据。
 */
export const founderHtml = `
<section id="founder" class="founder" aria-labelledby="founder-title">
  <div class="founder-head">
    <figure class="founder-portrait">
      <img src="/ip/shuai-portrait-a.png" alt="李帅帅肖像" width="320" height="320" loading="lazy">
    </figure>
    <div class="founder-copy">
      <p class="founder-eyebrow">创始人</p>
      <h2 id="founder-title">李帅帅</h2>
      <p class="founder-line">童医魔盒创始人，做医疗内容与 AI 工具落地。</p>
      <p class="founder-note">下面是个人的形象与项目资料，不是公司交付案例；公司已核验案例请看「可信案例」。</p>
      <p class="founder-links"><a href="https://xiaozhiserver.cloud/" rel="noreferrer noopener" target="_blank">个人官网</a><a href="/cases">公司可信案例</a></p>
    </div>
    <figure class="founder-hero">
      <img src="/ip/hero-cut/wave.webp" alt="李帅帅卡通形象 · 挥手" width="240" height="360" loading="lazy">
    </figure>
  </div>
  <div class="founder-projects" aria-label="个人项目资料">
    <figure class="founder-project">
      <img src="/ip/projects/starbridge-poster.jpg" alt="星桥项目海报" loading="lazy">
      <figcaption><strong>星桥</strong><span>儿童康复协作 · 项目资料（有路演与获奖记录）</span></figcaption>
    </figure>
    <figure class="founder-project">
      <img src="/ip/projects/tongyimohe-roadshow.jpg" alt="童医魔盒路演现场" loading="lazy">
      <figcaption><strong>童医魔盒</strong><span>公司品牌 · 团队与路演记录</span></figcaption>
    </figure>
    <figure class="founder-project">
      <img src="/ip/projects/xiaoan-presentation.jpg" alt="小安项目展示现场" loading="lazy">
      <figcaption><strong>小安</strong><span>硬件相关 · 项目资料（有获奖记录）</span></figcaption>
    </figure>
  </div>
</section>`;

/** 挂载后处理锚点滚动：portal 页是客户端渲染，浏览器默认锚点会早于本区块插入。 */
export function focusFounder(): void {
  if (location.hash !== '#founder') return;
  const section = document.getElementById('founder');
  if (section === null) return;
  section.scrollIntoView({ block: 'start' });
}
