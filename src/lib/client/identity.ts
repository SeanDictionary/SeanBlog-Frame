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
 * 把 WebGL renderer 字符串清洗成干净的显卡型号。仅处理常见 NVIDIA/Intel/AMD
 * 桌面与移动卡；解析不到有意义的型号时原样返回，避免丢信息。
 *
 * 清洗步骤：剥 ANGLE(...) 外壳 → 去开头重复的 "Vendor," → 去后端后缀
 * (Direct3D / OpenGL / Metal / Vulkan / D3D 等) → 去 PCI ID (0x...)。
 * 规范化后若不含数字或已知型号关键词，回退原始串（如 Apple Silicon）。
 */
function normalizeGpu(raw: string): string {
  let s = raw.trim()
  const angle = s.match(/^ANGLE\s*\((.*)\)$/i)
  if (angle) s = angle[1].trim()
  s = s.replace(/^[A-Za-z0-9]+,\s*/i, '')
  s = s.replace(/\s*(Direct3D.*|OpenGL ES.*|OpenGL.*|Metal.*|Vulkan.*|, D3D.*)$/i, '')
  s = s.replace(/\s*\(0x[0-9a-fA-F]+\)/g, '')
  s = s.trim()
  const meaningful = /\d|GeForce|Radeon|Arc|Iris|UHD|HD Graphics|Apple M|Apple GPU|Mali|Adreno/i
  return meaningful.test(s) ? s : raw
}

/**
 * 通过 WebGL 探测 GPU 型号。优先取 UNMASKED_RENDERER（更真实），
 * 不可用时回退标准 RENDERER，再经 normalizeGpu 清洗；无 WebGL/隐私模式返回 null。
 */
function getGpuInfo(): string | null {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return null

    let renderer: string | null = null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    if (!renderer) renderer = gl.getParameter(gl.RENDERER)

    const rendererStr = renderer ? String(renderer) : null
    return rendererStr ? normalizeGpu(rendererStr) : null
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
