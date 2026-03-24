import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

interface YTPlayerOptions {
  videoId?: string
  width?: number | string
  height?: number | string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onStateChange?: (e: { data: number }) => void
  }
}

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  setPlaybackRate(rate: number): void
  getCurrentTime(): number
  destroy(): void
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
  PlayerState: { PLAYING: 1; PAUSED: 2 }
}

declare global {
  interface Window {
    YT: YTNamespace
    onYouTubeIframeAPIReady: () => void
  }
}

let apiReady = false
const pendingCallbacks: (() => void)[] = []

function ensureYouTubeAPI(onReady: () => void) {
  if (apiReady) { onReady(); return }
  pendingCallbacks.push(onReady)
  if (document.getElementById('yt-iframe-api')) return
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true
    pendingCallbacks.splice(0).forEach(cb => cb())
  }
  const tag = document.createElement('script')
  tag.id = 'yt-iframe-api'
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null
    const parts = u.pathname.split('/')
    const liveIdx = parts.indexOf('live')
    if (liveIdx !== -1 && parts[liveIdx + 1]) return parts[liveIdx + 1].split('?')[0]
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

export interface YouTubePlayerHandle {
  seekTo: (seconds: number) => void
  play: () => void
  pause: () => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
}

interface YouTubePlayerProps {
  videoUrl: string
  initialTime?: number
  onPlay?: (currentTime: number) => void
  onPause?: (currentTime: number) => void
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoUrl, initialTime, onPlay, onPause }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const onPlayRef = useRef(onPlay)
    const onPauseRef = useRef(onPause)
    onPlayRef.current = onPlay
    onPauseRef.current = onPause

    useImperativeHandle(ref, () => ({
      seekTo: (s) => playerRef.current?.seekTo(s, true),
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      setPlaybackRate: (r) => playerRef.current?.setPlaybackRate(r),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    }))

    useEffect(() => {
      const videoId = extractVideoId(videoUrl)
      if (!videoId || !wrapperRef.current) return

      const target = document.createElement('div')
      wrapperRef.current.appendChild(target)
      let destroyed = false

      ensureYouTubeAPI(() => {
        if (destroyed || !target.isConnected) return
        playerRef.current = new window.YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              if (initialTime) playerRef.current?.seekTo(initialTime, true)
            },
            onStateChange: (e) => {
              const t = playerRef.current?.getCurrentTime() ?? 0
              if (e.data === window.YT.PlayerState.PLAYING) onPlayRef.current?.(t)
              else if (e.data === window.YT.PlayerState.PAUSED) onPauseRef.current?.(t)
            },
          },
        })
      })

      return () => {
        destroyed = true
        try { playerRef.current?.destroy() } catch { /* ignore */ }
        playerRef.current = null
        if (wrapperRef.current) wrapperRef.current.innerHTML = ''
      }
    }, [videoUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    return <div ref={wrapperRef} style={{ width: '100%', height: '100%' }} />
  }
)
