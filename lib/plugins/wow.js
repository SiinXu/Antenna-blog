const { loadExternalResource } = require('../utils')

/**
 * WOW.js 动画（自带实现，替代 cdnjs 上的 wow.min.js 1.1.2）
 * 行为与 WOW 默认配置一致：boxClass='wow'，animateClass='animated'，offset=0，mobile=true，live=true。
 * - 初始化时把所有 .wow 元素设为 visibility:hidden 且 animation-name:none；
 * - 元素进入视口后恢复可见，补回原 animation-name，并按 data-wow-duration / delay / iteration 设置动画，加上 animated 类；
 * - 之后新插入的 .wow 元素（翻页、路由切换）同样处理。
 * 用 IntersectionObserver 代替 50ms 轮询 scroll，省掉一次第三方脚本请求和主线程开销。
 */
let io = null
let mo = null

function customStyle(box, hidden, duration, delay, iteration) {
  if (hidden) {
    const name = getComputedStyle(box).animationName
    box.__wowName = name === 'none' ? '' : name
  }
  box.style.visibility = hidden ? 'hidden' : 'visible'
  if (duration) box.style.animationDuration = duration
  if (delay) box.style.animationDelay = delay
  if (iteration) box.style.animationIterationCount = iteration
  box.style.animationName = hidden ? 'none' : box.__wowName
}

function applyStyle(box, hidden) {
  const duration = box.getAttribute('data-wow-duration')
  const delay = box.getAttribute('data-wow-delay')
  const iteration = box.getAttribute('data-wow-iteration')
  requestAnimationFrame(() =>
    customStyle(box, hidden, duration, delay, iteration)
  )
}

function resetAnimation(event) {
  const target = event.target
  target.className = target.className.replace('animated', '').trim()
}

function show(box) {
  applyStyle(box, false)
  box.className = box.className + ' animated'
  box.addEventListener('animationend', resetAnimation)
  try {
    box.dispatchEvent(new Event('wow'))
  } catch (e) {}
}

function track(box) {
  if (box.__wowTracked) return
  box.__wowTracked = true
  applyStyle(box, true)
  io.observe(box)
}

function initWow() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return
  }
  if (!io) {
    io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          io.unobserve(entry.target)
          show(entry.target)
        }
      })
    })
  }
  document.querySelectorAll('.wow').forEach(track)
  if (!mo && 'MutationObserver' in window) {
    mo = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return
          if (node.classList.contains('wow')) track(node)
          node.querySelectorAll && node.querySelectorAll('.wow').forEach(track)
        })
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })
  }
}

export const loadWowJS = async () => {
  await loadExternalResource('/css/wow/animate.css', 'css')
  initWow()
}
