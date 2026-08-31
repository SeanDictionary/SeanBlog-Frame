// Client-side identity helpers shared by the analytics tracker, the comment
// form (visitor id) and the admin operation-log fetch wrapper (browser
// fingerprint / hardware). All functions touch browser globals and must only
// be called from client components.

const VISITOR_STORAGE_KEY = 'seanblog:analytics-visitor-id'

export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null

  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
  if (existing) return existing

  const value = crypto.randomUUID()
  window.localStorage.setItem(VISITOR_STORAGE_KEY, value)
  return value
}

export function getBrowserFingerprint(): string {
  return JSON.stringify({
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  })
}

/**
 * 通过 WebGL 探测 GPU 型号。优先取 UNMASKED_RENDERER/VENDOR（更真实），
 * 不可用时回退到标准 RENDERER/VENDOR，再不行返回 null。
 * 隐私模式或无 WebGL 环境会返回 null，对应字段不会写入 hardware。
 */
function getGpuInfo(): string | null {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return null

    let renderer: string | null = null
    let vendor: string | null = null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
    }
    if (!renderer) renderer = gl.getParameter(gl.RENDERER)
    if (!vendor) vendor = gl.getParameter(gl.VENDOR)

    const rendererStr = renderer ? String(renderer) : null
    const vendorStr = vendor ? String(vendor) : null
    if (rendererStr && vendorStr) return `${rendererStr} (${vendorStr})`
    return rendererStr ?? vendorStr
  } catch {
    return null
  }
}

export function getHardwareSummary(): string {
  const data: Record<string, number | string> = {}
  if (typeof navigator.hardwareConcurrency === 'number') {
    data.cores = navigator.hardwareConcurrency
  }
  if ('deviceMemory' in navigator && typeof navigator.deviceMemory === 'number') {
    data.memory = navigator.deviceMemory
  }
  const gpu = getGpuInfo()
  if (gpu) data.gpu = gpu
  return JSON.stringify(data)
}
