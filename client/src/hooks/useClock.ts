import { useState, useRef, useCallback } from 'react'

interface ClockState {
  running: boolean
  speed: number
  offsetSeconds: number
  startedAt: number | null
}

export function useClock() {
  const [state, setState] = useState<ClockState>({
    running: false,
    speed: 1,
    offsetSeconds: 0,
    startedAt: null,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const currentTime = useCallback((): number => {
    const s = stateRef.current
    if (!s.running || s.startedAt === null) return Math.floor(s.offsetSeconds)
    const elapsed = ((Date.now() - s.startedAt) / 1000) * s.speed
    return Math.floor(s.offsetSeconds + elapsed)
  }, [])

  const setInitialTimestamp = useCallback((ts: number) => {
    setState({ running: true, speed: 1, offsetSeconds: ts, startedAt: Date.now() })
  }, [])

  const pause = useCallback(() => {
    setState(s => {
      if (!s.running || s.startedAt === null) return s
      const elapsed = ((Date.now() - s.startedAt) / 1000) * s.speed
      return { ...s, running: false, offsetSeconds: s.offsetSeconds + elapsed, startedAt: null }
    })
  }, [])

  const resume = useCallback(() => {
    setState(s => {
      if (s.running) return s
      return { ...s, running: true, startedAt: Date.now() }
    })
  }, [])

  const setSpeed = useCallback((speed: number) => {
    setState(s => {
      let offset = s.offsetSeconds
      if (s.running && s.startedAt !== null) {
        offset = s.offsetSeconds + ((Date.now() - s.startedAt) / 1000) * s.speed
      }
      return { ...s, speed, offsetSeconds: offset, startedAt: s.running ? Date.now() : null }
    })
  }, [])

  return { state, currentTime, setInitialTimestamp, pause, resume, setSpeed }
}
