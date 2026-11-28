import { siteConfig } from '@/lib/config'
import { loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'

/**
 * Coze-AI机器人
 * @returns
 */
export default function Coze() {
  const cozeSrc = siteConfig(
    'COZE_SRC_URL',
    'https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.1.0-beta.0/libs/cn/index.js'
  )
  const title = siteConfig('COZE_TITLE', 'Coze')
  const botId = siteConfig('COZE_BOT_ID')

  const loadCoze = async () => {
    try {
      await loadExternalResource(cozeSrc)
      const CozeWebSDK = window?.CozeWebSDK
      if (CozeWebSDK) {
        const cozeClient = new CozeWebSDK.WebChatClient({
          config: {
            bot_id: botId
          },
          componentProps: {
            title: title
          }
        })
        console.log('Coze SDK initialized successfully')
      }
    } catch (error) {
      console.error('Failed to load Coze SDK:', error)
    }
  }

  useEffect(() => {
    if (!botId) {
      return
    }
    // 性能：SDK（约 150KB）不再和首屏抢带宽/主线程。
    // 页面加载完后空闲时加载（最晚 4 秒），用户先有交互则立即加载；聊天按钮功能不变。
    let done = false
    let idleId = null
    let timer = null
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    const start = () => {
      if (done) return
      done = true
      events.forEach(e => window.removeEventListener(e, start))
      window.removeEventListener('load', onLoad)
      loadCoze()
    }
    const onLoad = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(start, { timeout: 4000 })
      } else {
        timer = setTimeout(start, 2000)
      }
    }
    events.forEach(e =>
      window.addEventListener(e, start, { once: true, passive: true })
    )
    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad)
    }
    return () => {
      events.forEach(e => window.removeEventListener(e, start))
      window.removeEventListener('load', onLoad)
      if (idleId && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timer) clearTimeout(timer)
    }
  }, [])

  return <></>
}
