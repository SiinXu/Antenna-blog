import { siteConfig } from '@/lib/config'
import OptimizedGifVideo from '@/components/OptimizedGifVideo'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { resolveOptimizedMedia } from '@/lib/notion/optimizedMedia'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 * @param {*} param0
 * @returns
 */
const NotionPage = ({ post, className }) => {
  // 性能：西瓜视频 / B 站等第三方播放器 iframe 先不带 src 渲染，等页面 load 完成、空闲后，
  // 再按接近视口的顺序挂上原地址（布局、尺寸与原来相同，播放器本身不变）。
  const { blockMap, deferredEmbeds } = useMemo(
    () => deferThirdPartyEmbeds(post?.blockMap),
    [post?.blockMap]
  )
  useDeferredEmbeds(deferredEmbeds)

  // 是否关闭数据库和画册的点击跳转
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom =
    isBrowser &&
    mediumZoom({
      //   container: '.notion-viewport',
      background: 'rgba(0, 0, 0, 0.2)',
      margin: getMediumZoomMargin()
    })

  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)
  // 页面首次打开时执行的勾子
  useEffect(() => {
    // 检测当前的url并自动滚动到对应目标
    autoScrollToHash()
  }, [])

  // 页面文章发生变化时会执行的勾子
  useEffect(() => {
    // 相册视图点击禁止跳转，只能放大查看图片
    if (POST_DISABLE_GALLERY_CLICK) {
      // 针对页面中的gallery视图，点击后是放大图片还是跳转到gallery的内部页面
      processGalleryImg(zoomRef?.current)
    }

    // 页内数据库点击禁止跳转，只能查看
    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl()
    }

    /**
     * 放大查看图片时替换成高清图像
     */
    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            // 等待动画完成后替换为更高清的图像
            setTimeout(() => {
              // 获取该元素的 src 属性
              const src = mutation?.target?.getAttribute('src')
              //   替换为更高清的图像
              mutation?.target?.setAttribute(
                'src',
                compressImage(src, IMAGE_ZOOM_IN_WIDTH)
              )
            }, 800)
          }
        }
      })
    })

    // 监视页面元素和属性变化
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    })

    return () => {
      observer.disconnect()
    }
  }, [post])

  useEffect(() => {
    // Spoiler文本功能
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          window.textToSpoiler &&
            window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG))
        })
      })
    }
  }, [post])

  return (
    <div
      id='notion-article'
      className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        forceCustomImages
        components={{
          Image: NotionImage,
          Code,
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet
        }}
      />

      <AdEmbed />
      <PrismMac />
    </div>
  )
}

/**
 * Image renderer for react-notion-x. Same markup as the library default
 * (<img loading=lazy decoding=async>), except self-hosted GIFs become a
 * muted looping MP4 with a poster, and optimized images get their original
 * width/height so the browser can reserve space.
 */
const NotionImage = ({ src, alt, className, style, height, onLoad }) => {
  const media = resolveOptimizedMedia(src)
  const imgRef = useRef(null)
  useEffect(() => {
    // An image that finished loading before hydration never fires onLoad;
    // call it so zoom still attaches (the library default used a ref for this).
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth && onLoad) {
      onLoad({ target: img })
    }
  }, [src])
  if (media && media.type === 'video') {
    return (
      <OptimizedGifVideo
        media={media}
        alt={alt}
        className={className}
        style={style}
        zoomable
        intrinsicSize
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      style={style}
      ref={imgRef}
      src={src}
      alt={alt}
      onLoad={onLoad}
      width={media?.width}
      height={height || media?.height}
      loading='lazy'
      decoding='async'
    />
  )
}

/**
 * 页面的数据库链接禁止跳转，只能查看
 */
const processDisableDatabaseUrl = () => {
  if (isBrowser) {
    const links = document.querySelectorAll('.notion-table a')
    for (const e of links) {
      e.removeAttribute('href')
    }
  }
}

/**
 * gallery视图，点击后是放大图片还是跳转到gallery的内部页面
 */
const processGalleryImg = zoom => {
  setTimeout(() => {
    if (isBrowser) {
      const imgList = document?.querySelectorAll(
        '.notion-collection-card-cover img'
      )
      if (imgList && zoom) {
        for (let i = 0; i < imgList.length; i++) {
          zoom.attach(imgList[i])
        }
      }

      const cards = document.getElementsByClassName('notion-collection-card')
      for (const e of cards) {
        e.removeAttribute('href')
      }
    }
  }, 800)
}

/**
 * 根据url参数自动滚动到锚位置
 */
const autoScrollToHash = () => {
  setTimeout(() => {
    // 跳转到指定标题
    const hash = window?.location?.hash
    const needToJumpToTitle = hash && hash.length > 0
    if (needToJumpToTitle) {
      console.log('jump to hash', hash)
      const tocNode = document.getElementById(hash.substring(1))
      if (tocNode && tocNode?.className?.indexOf('notion') > -1) {
        tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
  }, 180)
}

/**
 * 将id映射成博文内部链接。
 * @param {*} id
 * @returns
 */
const mapPageUrl = id => {
  // return 'https://www.notion.so/' + id.replace(/-/g, '')
  return '/' + id.replace(/-/g, '')
}

/**
 * 缩放
 * @returns
 */
function getMediumZoomMargin() {
  const width = window.innerWidth

  if (width < 500) {
    return 8
  } else if (width < 800) {
    return 20
  } else if (width < 1280) {
    return 30
  } else if (width < 1600) {
    return 40
  } else if (width < 1920) {
    return 48
  } else {
    return 72
  }
}

// 代码
const Code = dynamic(
  () =>
    import('react-notion-x/build/third-party/code').then(async m => {
      return m.Code
    }),
  { ssr: false }
)

// 公式
const Equation = dynamic(
  () =>
    import('@/components/Equation').then(async m => {
      // 化学方程式
      await import('@/lib/plugins/mhchem')
      return m.Equation
    }),
  { ssr: false }
)

// 原版文档
// const Pdf = dynamic(
//   () => import('react-notion-x/build/third-party/pdf').then(m => m.Pdf),
//   {
//     ssr: false
//   }
// )
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), {
  ssr: false
})

// 美化代码 from: https://github.com/txs
const PrismMac = dynamic(() => import('@/components/PrismMac'), {
  ssr: false
})

/**
 * tweet嵌入
 */
const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

/**
 * 文内google广告
 */
const AdEmbed = dynamic(
  () => import('@/components/GoogleAdsense').then(m => m.AdEmbed),
  { ssr: true }
)

const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      m => m.Collection
    ),
  {
    ssr: true
  }
)

const Modal = dynamic(
  () => import('react-notion-x/build/third-party/modal').then(m => m.Modal),
  { ssr: false }
)

const Tweet = ({ id }) => {
  return <TweetEmbed tweetId={id} />
}

export default NotionPage

const DEFERRED_EMBED_RE = /(^https?:\/\/([a-z0-9-]+\.)*(ixigua\.com|bilibili\.com)\/)/i

/**
 * 把第三方播放器 embed 的地址换成 about:blank（只复制被改的 block，不动原数据）
 * @returns {{blockMap: object, deferredEmbeds: Array<[string, string]>}}
 */
function deferThirdPartyEmbeds(recordMap) {
  const deferredEmbeds = []
  if (!recordMap?.block) return { blockMap: recordMap, deferredEmbeds }
  let blocks = null
  for (const [id, entry] of Object.entries(recordMap.block)) {
    const block = entry?.value
    if (!block || block.type !== 'embed') continue
    const source = block.properties?.source?.[0]?.[0]
    const src = block.format?.display_source || source
    if (!src || !DEFERRED_EMBED_RE.test(src)) continue
    if (recordMap.signed_urls?.[block.id]) continue
    blocks = blocks || { ...recordMap.block }
    blocks[id] = {
      ...entry,
      value: {
        ...block,
        format: { ...block.format, display_source: 'about:blank' },
        properties: { ...block.properties, source: [['about:blank']] }
      }
    }
    deferredEmbeds.push([block.id, src])
  }
  if (!blocks) return { blockMap: recordMap, deferredEmbeds }
  return { blockMap: { ...recordMap, block: blocks }, deferredEmbeds }
}

function useDeferredEmbeds(deferredEmbeds) {
  useEffect(() => {
    if (!deferredEmbeds?.length) return
    let io = null
    let idleId = null
    let timer = null
    const attach = () => {
      const targets = []
      deferredEmbeds.forEach(([id, src]) => {
        const iframe = document.querySelector(
          `figure.notion-asset-wrapper.${CSS.escape(id)} iframe`
        )
        if (iframe && iframe.getAttribute('src') === 'about:blank') {
          iframe.dataset.src = src
          targets.push(iframe)
        }
      })
      if (!targets.length) return
      const load = el => {
        if (el.dataset.src) {
          el.setAttribute('src', el.dataset.src)
          delete el.dataset.src
        }
      }
      if (!('IntersectionObserver' in window)) {
        targets.forEach(load)
        return
      }
      io = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              io.unobserve(entry.target)
              load(entry.target)
            }
          })
        },
        { rootMargin: '600px 0px' }
      )
      targets.forEach(el => io.observe(el))
    }
    const onLoad = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(attach, { timeout: 3000 })
      } else {
        timer = setTimeout(attach, 1000)
      }
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      window.removeEventListener('load', onLoad)
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId)
      if (timer) clearTimeout(timer)
      if (io) io.disconnect()
    }
  }, [deferredEmbeds])
}
