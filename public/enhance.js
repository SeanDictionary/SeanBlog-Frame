/**
 * 平台渐进增强脚本（客户端，纯 vanilla JS，无依赖）
 * 主题给元素挂 data-sb-* 属性即可获得行为：
 *  [data-sb-comment-form]  评论提交 → POST /api/comments (JSON)
 *  [data-sb-search]         打开搜索弹窗
 *  [data-sb-theme-toggle]   深浅色切换 + cookie
 *  [data-sb-sidebar-toggle] 侧栏开合
 *  [data-sb-toc]            目录滚动高亮
 */
;(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // --- 深浅色切换 ---
  ready(function () {
    document.querySelectorAll('[data-sb-theme-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
        var next = cur === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        document.cookie = 'sb-theme=' + next + ';path=/;max-age=31536000;SameSite=Lax'
      })
    })
  })

  // --- 侧栏开合 ---
  ready(function () {
    document.querySelectorAll('[data-sb-sidebar-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var sel = el.getAttribute('data-sb-sidebar-toggle') || ''
        var target = document.querySelector(sel)
        if (!target) return
        var open = target.getAttribute('data-open') === 'true'
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
    var byId = {}
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1)
      if (document.getElementById(id) && !byId[id]) byId[id] = a
    })
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var a = byId[e.target.id]
          if (!a) return
          if (e.isIntersecting) {
            links.forEach(function (x) { x.removeAttribute('aria-current') })
            a.setAttribute('aria-current', 'true')
          }
        })
      }, { rootMargin: '0% 0% -80% 0%' })
      Object.keys(byId).forEach(function (id) {
        var t = document.getElementById(id)
        if (t) io.observe(t)
      })
    }
  })

  // --- 搜索弹窗 ---
  ready(function () {
    var overlay = null
    function ensureOverlay() {
      if (overlay) return overlay
      overlay = document.createElement('div')
      overlay.className = 'sb-search-overlay'
      overlay.setAttribute('hidden', '')
      overlay.innerHTML =
        '<div class="sb-search-dialog"><input type="search" placeholder="搜索文章…" /><ul class="sb-search-results"></ul></div>'
      document.body.appendChild(overlay)
      var input = overlay.querySelector('input')
      var list = overlay.querySelector('ul')
      var timer
      input.addEventListener('input', function () {
        window.clearTimeout(timer)
        var q = input.value.trim()
        if (!q) { list.innerHTML = ''; return }
        timer = window.setTimeout(function () {
          fetch('/api/search?q=' + encodeURIComponent(q))
            .then(function (r) { return r.json() })
            .then(function (data) {
              var items = (data.articles || data.items || []) || []
              list.innerHTML = items.slice(0, 8).map(function (a) {
                return '<li><a href="/articles/' + a.slug + '">' + (a.title || '') + '</a></li>'
              }).join('') || '<li class="sb-muted">无结果</li>'
            }).catch(function () {})
        }, 200)
      })
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.setAttribute('hidden', '') })
      return overlay
    }
    document.querySelectorAll('[data-sb-search]').forEach(function (el) {
      el.addEventListener('click', function () {
        var o = ensureOverlay()
        o.removeAttribute('hidden')
        var input = o.querySelector('input')
        if (input) input.focus()
      })
    })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hasAttribute('hidden')) overlay.setAttribute('hidden', '')
    })
  })

  // --- 评论提交（JSON，含全部字段）---
  ready(function () {
    document.querySelectorAll('[data-sb-comment-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        var f = form
        var status = f.querySelector('[data-sb-comment-status]')
        var fd = new FormData(f)
        var payload = {
          articleId: f.getAttribute('data-article-id') || '',
          content: String(fd.get('content') || ''),
          guestName: String(fd.get('guestName') || '').trim(),
          guestEmail: String(fd.get('guestEmail') || '').trim(),
          guestLink: String(fd.get('guestLink') || '').trim(),
          parentId: String(fd.get('parentId') || '').trim(),
        }
        if (!payload.content.trim()) {
          f.setAttribute('data-state', 'error')
          if (status) status.textContent = '请输入评论内容'
          return
        }
        f.setAttribute('data-state', 'submitting')
        var btn = f.querySelector('button[type=submit]')
        if (btn) btn.disabled = true
        if (status) status.textContent = '提交中…'
        fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
          .then(function (res) {
            if (res.ok && res.d && res.d.comment) {
              var st = res.d.comment.status || 'APPROVED'
              f.setAttribute('data-state', st === 'APPROVED' ? 'success' : 'pending')
              if (status) status.textContent = st === 'APPROVED' ? '评论成功，已显示。' : '已提交，待审核后显示。'
              f.reset()
            } else {
              f.setAttribute('data-state', 'error')
              if (status) status.textContent = (res.d && res.d.error && res.d.error.message) || '提交失败'
            }
          })
          .catch(function () {
            f.setAttribute('data-state', 'error')
            if (status) status.textContent = '网络错误，请重试'
          })
          .then(function () { if (btn) btn.disabled = false })
      })
    })
  })
})()
