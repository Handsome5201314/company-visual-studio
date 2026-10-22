// 资源基地址。线上以站点根目录部署（BASE_URL='/'），GitHub Pages 演示部署在
// 仓库子路径（例如 '/company-visual-studio/'）。运行时按需加载的模型、贴图与
// DRACO 解码器都必须经过这里，禁止再写死 '/'。
export const ASSET_BASE = import.meta.env.BASE_URL || '/';

export function asset(path: string): string {
  return `${ASSET_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

// 数据文件里的图片地址（例如 projects.json 的 /projects/*.png）按站点根目录书写；
// 部署在子路径时必须同样套用 base，绝对 URL 与 data: URI 保持原样。
export function assetPath(url: string): string {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) ? url : asset(url);
}
