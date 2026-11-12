export type ScreenId = 'command-map' | 'fleet-management' | 'incident-archive'

export interface ScreenNavigationItem {
  id: ScreenId
  label: string
  subtitle: string
  badgeCount?: number
}
