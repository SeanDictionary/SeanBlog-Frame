/**
 * 平台渐进增强脚本（客户端，无框架依赖）
 *
 * 主题给元素挂 data-sb-* 属性即可获得行为：
 *  - [data-sb-comment-form]  评论提交 → POST /api/comments
 *  - [data-sb-search]        打开搜索弹窗
 *  - [data-sb-theme-toggle]  深浅色切换 + cookie
 *  - [data-sb-sidebar-toggle] 移动侧栏开合
 *  - [data-sb-toc]           目录滚动高亮
 *
 * 不挂也能静态展示，只是无交互（渐进增强）。
 */
;(function () {
  function ready(fn: () => void) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // --- 深浅色切换 ---
  ready(function () {
    document.querySelectorAll('[data-sb-theme-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
        const next = cur === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        document.cookie = 'sb-theme=' + next + ';path=/;max-age=31536000;SameSite=Lax'
      })
    })
  })

  // --- 移动侧栏开合 ---
  ready(function () {
    document.querySelectorAll('[data-sb-sidebar-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        const sel = el.getAttribute('data-sb-sidebar-toggle') || ''
        const target = document.querySelector(sel)
        if (!target) return
        const open = target.getAttribute('data-open') === 'true'
        target.setAttribute('data-open', String(!open))
        target.classList.toggle('sb-sidebar-open', !open)
      })
    })
  })

  // --- 目录滚动高亮 ---
  ready(function () {
    var toc = document.querySelector('[data-sb-toc]')
    if (!toc) return
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'))
    if (!links.length) return
    var byId: Record<string, HTMLElement> = {}
    links.forEach(function (a: HTMLAnchorElement) {
      var id = a.getAttribute('href')!.slice(1)
      var t = document.getElementById(id)
      if (t) byId[id] = a
    })
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = byId[e.target.id]
        if (!a) return
        if (e.isIntersecting) {
          links.forEach(function (x: HTMLAnchorElement) { x.removeAttribute('aria-current') })
          a.setAttribute('aria-current', 'true')
        }
      })
    }, { rootMargin: '0% 0% -80% 0%' })
    Object.keys(byId).forEach(function (id) {
      var t = document.getElementById(id)
      if (t) io.observe(t)
    })
  })

  // --- 搜索弹窗（基础） ---
  ready(function () {
    var overlay: HTMLElement | null = null
    function ensureOverlay(): HTMLElement {
      if (overlay) return overlay
      overlay = document.createElement('div')
      overlay.className = 'sb-search-overlay'
      overlay.setAttribute('hidden', '')
      overlay.innerHTML =
        '<div class="sb-search-dialog"><input type="search" placeholder="搜索文章…" /><ul class="sb-search-results"></ul></div>'
      document.body.appendChild(overlay)
      var input = overlay.querySelector('input') as HTMLInputElement
      var list = overlay.querySelector('ul') as HTMLUListElement
      var timer: number | undefined
      input.addEventListener('input', function () {
        window.clearTimeout(timer)
        var q = input.value.trim()
        if (!q) { list.innerHTML = ''; return }
        timer = window.setTimeout(function () {
          fetch('/api/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json() }).then(function (data: any) {
            var items = (data.articles || data.items || []) as any[]
            list.innerHTML = items.slice(0, 8).map(function (a) {
              return '<li><a href="/articles/' + a.slug + '">' + (a.title || '') + '</a></li>'
            }).join('') || '<li class="sb-muted">无结果</li>'
          }).catch(function () {})
        }, 200)
      })
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay!.setAttribute('hidden', '') })
      return overlay
    }
    document.querySelectorAll('[data-sb-search]').forEach(function (el) {
      el.addEventListener('click', function () {
        var o = ensureOverlay()
        o.removeAttribute('hidden')
        var input = o.querySelector('input') as HTMLInputElement
        input && input.focus()
      })
    })
  })

  // --- 评论提交 ---
  ready(function () {
    document.querySelectorAll('[data-sb-comment-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        var f = form as HTMLFormElement
        var status = f.querySelector('[data-sb-comment-status]') as HTMLElement | null
        var fd = new FormData(f)
        fd.append('articleId', f.getAttribute('data-article-id') || '')
        f.setAttribute('data-state', 'submitting')
        if (status) status.textContent = '提交中…'
        fetch('/api/comments', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
          .then(function (res) {
            if (res.ok) {
              f.setAttribute('data-state', res.d.status === 'APPROVED' ? 'success' : 'pending')
              if (status) status.textContent = res.d.status === 'APPROVED' ? '评论成功，已显示。' : '已提交，待审核后显示。'
              f.reset()
            } else {
              f.setAttribute('data-state', 'error')
              if (status) status.textContent = res.d?.error?.message || '提交失败'
            }
          })
          .catch(function () {
            f.setAttribute('data-state', 'error')
            if (status) status.textContent = '网络错误，请重试'
          })
      })
    })
  })
})()
