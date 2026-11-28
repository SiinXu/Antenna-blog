import { useEffect, useRef, useState } from 'react'

/**
 * Drop-in replacement for an animated GIF <img>: a muted, looping,
 * inline MP4 with a WebP poster. The video file is only fetched when the
 * element comes near the viewport (lazy), unless `priority` is set.
 */
export default function OptimizedGifVideo({
  media,
  alt,
  className,
  style,
  id,
  title,
  onClick,
  priority = false,
  zoomable = false,
  intrinsicSize = false
}) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setActive(true)
          io.disconnect()
        }
      },
      { rootMargin: priority ? '0px' : '200px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [priority])

  useEffect(() => {
    const el = ref.current
    if (active && el) {
      el.load()
      const p = el.play && el.play()
      if (p && p.catch) p.catch(() => {})
    }
  }, [active])

  const handleClick = e => {
    if (typeof onClick === 'function') return onClick(e)
    if (zoomable && ref.current && ref.current.requestFullscreen) {
      ref.current.requestFullscreen().catch(() => {})
    }
  }

  return (
    <video
      ref={ref}
      id={id}
      title={title || alt}
      aria-label={alt}
      className={`gif-video ${className || ''}`}
      style={{
        aspectRatio: `${media.width} / ${media.height}`,
        ...(zoomable ? { cursor: 'zoom-in' } : {}),
        ...style
      }}
      poster={media.poster}
      width={intrinsicSize ? media.width : undefined}
      height={intrinsicSize ? media.height : undefined}
      autoPlay
      muted
      loop
      playsInline
      preload='none'
      onClick={handleClick}>
      {active && <source src={media.src} type='video/mp4' />}
    </video>
  )
}
