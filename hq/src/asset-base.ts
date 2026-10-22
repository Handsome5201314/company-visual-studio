// 资源基地址。线上以站点根目录部署（BASE_URL='/'），GitHub Pages 演示部署在
// 仓库子路径（例如 '/company-visual-studio/'）。运行时按需加载的模型、贴图与
// DRACO 解码器都必须经过这里，禁止再写死 '/'。
export const ASSET_BASE = import.meta.env.BASE_URL || '/';

export function asset(path: string): string {
  return `${ASSET_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
