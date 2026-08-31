/**
 * 平台访问统计埋点脚本（客户端，纯 vanilla JS，无依赖）
 *
 * 由 src/lib/theme/render-service.ts 经 platform_enhance 注入到所有公开主题页，
 * 主题包无需引用。逻辑与已移除的 React 版 AnalyticsTracker 对齐，
 * 客户端身份生成与 src/lib/client/identity.ts 保持逐字一致
 * （localStorage key、fingerprint / hardware JSON 格式），
 * 以保证评论与访问共享同一 visitorId，且后台指纹/硬件聚合不漂移。
 *
 * 公开页为传统 MPA（route.ts + Handlebars），每个页面独立加载，
 * 因此在 pagehide / visibilitychange→hidden 时为当前页发送一个事件。
 */
;(function () {
  var VISITOR_STORAGE_KEY = 'seanblog:analytics-visitor-id'

  function getVisitorId() {
    try {
      var existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
      if (existing) return existing
      var value = (crypto && crypto.randomUUID) ? crypto.randomUUID() : null
      if (!value) return null
      window.localStorage.setItem(VISITOR_STORAGE_KEY, value)
      return value
    } catch (e) {
      return null
    }
  }

  function getBrowserFingerprint() {
    try {
      return JSON.stringify({
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        devicePixelRatio: window.devicePixelRatio,
      })
    } catch (e) {
      return null
    }
  }

  function getGpuInfo() {
    try {
      var canvas = document.createElement('canvas')
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return null

      var renderer = null
      var vendor = null
      var ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
      }
      if (!renderer) renderer = gl.getParameter(gl.RENDERER)
      if (!vendor) vendor = gl.getParameter(gl.VENDOR)

      var r = renderer ? String(renderer) : null
      var v = vendor ? String(vendor) : null
      if (r && v) return r + ' (' + v + ')'
      return r || v
    } catch (e) {
      return null
    }
  }

  function getHardwareSummary() {
    try {
      var data = {}
      if (typeof navigator.hardwareConcurrency === 'number') {
        data.cores = navigator.hardwareConcurrency
      }
      if ('deviceMemory' in navigator && typeof navigator.deviceMemory === 'number') {
        data.memory = navigator.deviceMemory
      }
      var gpu = getGpuInfo()
      if (gpu) data.gpu = gpu
      return JSON.stringify(data)
    } catch (e) {
      return null
    }
  }

  function getContent(path) {
    var articleMatch = path.match(/^\/articles\/([^/]+)/)
    if (articleMatch) return { contentType: 'article', slug: decodeURIComponent(articleMatch[1]) }

    var categoryMatch = path.match(/^\/categories\/([^/]+)/)
    if (categoryMatch) return { contentType: 'category', slug: decodeURIComponent(categoryMatch[1]) }

    var tagMatch = path.match(/^\/tags\/([^/]+)/)
    if (tagMatch) return { contentType: 'tag', slug: decodeURIComponent(tagMatch[1]) }

    return { contentType: 'page', slug: null }
  }

  var startedAt = Date.now()
  var fullPath = location.pathname + (location.search || '')
  var referrer = document.referrer
  var sent = false

  function send() {
    if (sent) return
    sent = true

    var durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
    var content = getContent(fullPath)
    var payload = {
      path: fullPath,
      contentType: content.contentType,
      slug: content.slug,
      visitorId: getVisitorId(),
      referrer: referrer || null,
      browserFingerprint: getBrowserFingerprint(),
      hardware: getHardwareSummary(),
      durationSeconds: durationSeconds,
    }
    var body = JSON.stringify(payload)

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }))
        return
      }
    } catch (e) {
      // sendBeacon 不可用则回退 fetch
    }

    try {
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      })['catch'](function () {})
    } catch (e) {
      // 静默失败，不影响页面
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') send()
  }

  window.addEventListener('pagehide', send)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})()
