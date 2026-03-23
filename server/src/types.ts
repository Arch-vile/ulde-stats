export type EventType = 'possession_start' | 'pass' | 'turnover' | 'game-paused' | 'game-continued'
export type Outcome = 'success' | 'drop' | 'throwaway' | 'goal' | 'goal-drop' | 'goal-throwaway' | 'turnover' | ''

export interface Event {
  event_number: number
  timestamp: number
  event_type: EventType
  player: string
  target_player: string
  outcome: Outcome
}

export interface GameMeta {
  id: string
  date: string
  teamName: string
  opponent: string
  tournament: string
  videoUrl: string
  roster: string[]
}

export type Game = GameMeta & { events: Event[] }
