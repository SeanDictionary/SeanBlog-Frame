/**
 * 平台渐进增强脚本（客户端，纯 vanilla JS，无依赖）
 * 只处理“碰平台 API”的行为。纯展示交互由主题自己的 assets/js 处理。
 *
 * 主题放带 data-sb-* 属性的元素即可获得行为（不挂也能静态展示）：
 *  [data-sb-comment-form]   评论提交 → POST /api/comments (JSON，含全字段)
 *                           APPROVED 时按 data-sb-comment-target 刷新页面滚回评论区
 *  [data-sb-search]          打开搜索弹窗 → GET /api/search
 */
;(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // --- 搜索弹窗（弹窗 markup 由主题提供，这里只接线 fetch + 填充）---
  ready(function () {
    var dialog = document.querySelector('[data-sb-search-dialog]')
    if (!dialog) return
    var input = dialog.querySelector('[data-sb-search-input]')
    var results = dialog.querySelector('[data-sb-search-results]')
    var hint = dialog.querySelector('[data-sb-search-hint]')
    var tpl = dialog.querySelector('[data-sb-search-result-template]')
    var empty = dialog.querySelector('[data-sb-search-empty]')
    var fullLink = dialog.querySelector('[data-sb-search-full]')
    var timer
    var lastReq = 0

    function showState(state) {
      // state: 'hint' | 'results' | 'empty'
      if (hint) hint.hidden = state !== 'hint'
      if (results) results.hidden = state !== 'results'
      if (empty) empty.hidden = state !== 'empty'
    }
    function open() {
      dialog.removeAttribute('hidden')
      if (input) { input.value = ''; input.focus() }
      if (results) results.innerHTML = ''
      if (fullLink) fullLink.setAttribute('href', '/search')
      showState('hint')
    }
    function close() { dialog.setAttribute('hidden', '') }

    document.querySelectorAll('[data-sb-search]').forEach(function (el) {
      el.addEventListener('click', open)
    })
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close() })
    dialog.querySelectorAll('[data-sb-search-close]').forEach(function (el) {
      el.addEventListener('click', close)
    })
    document.addEventListener('keydown', function (e) {
      // ⌘K / Ctrl+K 打开
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      }
      if (e.key === 'Escape' && !dialog.hasAttribute('hidden')) close()
    })

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]
      })
    }
    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
    function highlight(text, q) {
      // 空格或 + 分隔多关键词，大小写不敏感，转义后包裹 <mark>
      var terms = String(q || '').split(/[\s+]+/).filter(Boolean).map(escapeRe)
      if (!terms.length) return escapeHtml(text)
      var re = new RegExp('(' + terms.join('|') + ')', 'gi')
      var out = ''
      var src = String(text || '')
      var last = 0
      var m
      while ((m = re.exec(src))) {
        out += escapeHtml(src.slice(last, m.index))
        out += '<mark class="sb-mark">' + escapeHtml(m[0]) + '</mark>'
        last = m.index + m[0].length
        if (m[0].length === 0) re.lastIndex++ // 防止零宽匹配死循环
      }
      out += escapeHtml(src.slice(last))
      return out
    }

    if (input) input.addEventListener('input', function () {
      window.clearTimeout(timer)
      var q = input.value.trim()
      if (fullLink) fullLink.setAttribute('href', q ? '/search?q=' + encodeURIComponent(q) : '/search')
      if (!q) { if (results) results.innerHTML = ''; showState('hint'); return }
      timer = window.setTimeout(function () {
        var reqId = ++lastReq
        fetch('/api/search?q=' + encodeURIComponent(q))
          .then(function (r) { return r.json() })
          .then(function (data) {
            if (reqId !== lastReq) return // 旧请求被覆盖
            if (!results) return
            results.innerHTML = ''
            var items = ((data.articles || data.items || []) || []).slice(0, 8)
            if (!items.length) { showState('empty'); return }
            showState('results')
            items.forEach(function (a) {
              if (!tpl) return
              var node = tpl.content.cloneNode(true)
              var link = node.querySelector('[data-sb-result-link]')
              var title = node.querySelector('[data-sb-result-title]')
              var excerpt = node.querySelector('[data-sb-result-excerpt]')
              var meta = node.querySelector('[data-sb-result-meta]')
              if (link) link.setAttribute('href', '/articles/' + (a.slug || ''))
              if (title) title.innerHTML = highlight(a.title || '', q)
              if (excerpt && a.excerpt) excerpt.innerHTML = highlight(a.excerpt, q)
              else if (excerpt) excerpt.remove()
              if (meta) {
                var parts = []
                if (a.category && a.category.name) parts.push(a.category.name)
                if (a.publishedAt) parts.push(String(a.publishedAt).slice(0, 10))
                if (parts.length) meta.textContent = parts.join(' · ')
                else meta.remove()
              }
              results.appendChild(node)
            })
          }).catch(function () {})
      }, 200)
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
              // APPROVED：评论已显示，刷新页面以展示新评论并滚回评论区（由 data-sb-comment-target 声明目标）
              if (st === 'APPROVED') {
                var target = f.getAttribute('data-sb-comment-target')
                setTimeout(function () {
                  if (target) { try { location.hash = target.replace(/^#/, '') } catch (e) {} }
                  location.reload()
                }, 900)
              }
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
