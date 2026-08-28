/**
 * 默认主题脚本（主题级交互，纯展示，不碰 API）
 * - 评论回复：点回复按钮设 parentId + 显示 banner + 聚焦；取消恢复
 * - 侧栏开合、目录滚动高亮
 *
 * 平台行为（评论提交 / 搜索 / cookie）由 /enhance.js 处理。
 */
;(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  ready(function () {
    var form = document.querySelector('[data-sb-comment-form]')
    if (!form) return
    var parentInput = form.querySelector('[name=parentId]')
    var banner = form.querySelector('[data-sb-reply-banner]')
    var bannerText = form.querySelector('[data-sb-reply-text]')

    document.querySelectorAll('[data-sb-reply-to]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-sb-reply-to')
        var author = btn.getAttribute('data-sb-reply-author') || ''
        if (parentInput) parentInput.value = id
        if (banner && bannerText) {
          bannerText.textContent = '回复 @' + author
          banner.removeAttribute('hidden')
        }
        var ta = form.querySelector('textarea[name=content]')
        form.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (ta) setTimeout(function () { ta.focus() }, 300)
      })
    })

    var cancel = form.querySelector('[data-sb-reply-cancel]')
    if (cancel) cancel.addEventListener('click', function () {
      if (parentInput) parentInput.value = ''
      if (banner) banner.setAttribute('hidden', '')
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
})()
