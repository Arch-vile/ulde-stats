export type EventType = 'possession_start' | 'pass' | 'turnover'
export type Outcome = 'success' | 'drop' | 'throwaway' | 'goal' | 'goal-drop' | 'goal-throwaway' | 'turnover' | ''

export interface Event {
  timestamp: number
  event_type: EventType
  player: string
  target_player: string
  outcome: Outcome
  possession_id: number
  event_number: number
}

export interface GameMeta {
  id: string
  opponent: string
  date: string
}
