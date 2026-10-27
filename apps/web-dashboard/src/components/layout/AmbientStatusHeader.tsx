import type { ScreenId, ScreenNavigationItem } from '../../types/navigation'

export interface AmbientStatusHeaderProps {
  activeScreen: ScreenId
  onSelectScreen: (screenId: ScreenId) => void
  activeAlertCount?: number
  gatewayStatus?: 'online' | 'degraded' | 'offline'
  operatingMode?: 'lora-mesh-blackout' | 'cloud-sync'
}

const NAV_ITEMS: ScreenNavigationItem[] = [
  {
    id: 'command-map',
    label: 'Command Map & Triage CAD',
    subtitle: 'Primary Live Operations',
  },
  {
    id: 'fleet-management',
    label: 'Field Responder Fleet',
    subtitle: 'Status & Fatigue',
  },
  {
    id: 'incident-archive',
    label: 'Incident Archive',
    subtitle: 'Audit & Records',
  },
]

export function AmbientStatusHeader({
  activeScreen,
  onSelectScreen,
  activeAlertCount = 4,
  gatewayStatus = 'online',
  operatingMode = 'lora-mesh-blackout',
}: AmbientStatusHeaderProps) {
  return (
    <header
      data-testid="ambient-status-header"
      className="ambient-status-header border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 select-none"
    >
      {/* Brand & Ambient Hardware Telemetry */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          <h1 className="font-bold tracking-tight text-base uppercase text-[var(--text-primary)]">
            SALBAR <span className="text-[var(--text-secondary)] font-normal text-xs">EOC</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[var(--text-secondary)] flex-wrap">
          {/* LoRa Gateway Status */}
          <span
            data-testid="status-gateway"
            className="px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gatewayStatus === 'online'
                  ? 'bg-[var(--color-emergency-success)]'
                  : 'bg-[var(--color-emergency-critical)]'
              }`}
            />
            COM3: {gatewayStatus === 'online' ? 'Online (915 MHz)' : 'Disconnected'}
          </span>

          {/* Operating Mode */}
          <span
            data-testid="status-mode"
            className="px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]"
          >
            Mode: {operatingMode === 'lora-mesh-blackout' ? 'LoRa Mesh Blackout' : 'Cloud Sync Active'}
          </span>

          {/* Active Emergencies Counter */}
          <span
            data-testid="status-alerts"
            className="px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-semibold"
          >
            Alerts: {activeAlertCount} Active
          </span>
        </div>
      </div>

      {/* Screen Navigation Tabs */}
      <nav
        data-testid="screen-navigation-tabs"
        className="flex items-center gap-1 overflow-x-auto"
        aria-label="Operations Screen Switcher"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-tab-${item.id}`}
              onClick={() => onSelectScreen(item.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border-[var(--border-focus)]'
                  : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}

export default AmbientStatusHeader
