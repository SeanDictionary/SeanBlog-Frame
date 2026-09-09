import packageJson from '@/../package.json'
import { NextResponse } from 'next/server'

// 公开无鉴权：供 install.sh 在部署/升级时读取当前运行版本（registry 镜像与
// 源码构建均有效，版本来自打包进镜像的 package.json）。仅暴露版本号，非敏感。
export function GET() {
  return NextResponse.json({ status: 'ok', version: packageJson.version })
}
