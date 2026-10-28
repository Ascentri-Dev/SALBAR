import { useState } from 'react'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScreenId, ScreenNavigationItem } from '../../types/navigation'
import { useTheme } from '../../context'

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
    label: 'Command Map & Triage',
    subtitle: 'Primary Live Operations',
  },
  {
    id: 'fleet-management',
    label: 'Field Responders',
    subtitle: 'Status & Fatigue',
  },
  {
    id: 'incident-archive',
    label: 'Incident Archive',
    subtitle: 'Audit & Records',
  },
]

interface AnimatedLinkProps {
  title: string
  id: ScreenId
  isActive?: boolean
  onClick: (id: ScreenId) => void
}

const AnimatedLink = ({ title, id, isActive, onClick }: AnimatedLinkProps) => {
  return (
    <button
      type="button"
      data-testid={`nav-tab-${id}`}
      onClick={() => onClick(id)}
      className="font-heading relative overflow-hidden group cursor-pointer text-xs xl:text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] block shrink-0 transition-colors"
    >
      <span
        className={`block transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
          isActive
            ? '-translate-y-full text-[var(--accent-primary)]'
            : 'group-hover:-translate-y-full text-[var(--text-primary)]'
        }`}
      >
        {title}
      </span>
      <span
        className={`absolute inset-0 block transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] text-[var(--accent-primary)] ${
          isActive ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'
        }`}
      >
        {title}
      </span>
    </button>
  )
}

export function AmbientStatusHeader({
  activeScreen,
  onSelectScreen,
  activeAlertCount = 4,
  gatewayStatus = 'online',
  operatingMode = 'lora-mesh-blackout',
}: AmbientStatusHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const handleSelectScreen = (screenId: ScreenId) => {
    setIsMobileMenuOpen(false)
    onSelectScreen(screenId)
  }

  return (
    <header
      data-testid="ambient-status-header"
      className="w-full z-40 px-3 md:px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-md select-none shrink-0"
    >
      <div className="w-full relative">
        {/* Main Skewed Navbar Container */}
        <div className="w-full flex items-center justify-between bg-[var(--bg-surface)]/90 backdrop-blur-2xl border border-[var(--border-subtle)] rounded-sm px-4 sm:px-8 py-2.5 transition-all duration-500 -skew-x-12 shadow-xl shadow-black/15">
          {/* Left: Brand Logo & Station Badge (Skew inverted) */}
          <div className="flex-1 flex justify-start items-center gap-3 skew-x-12">
            <button
              type="button"
              onClick={() => handleSelectScreen('command-map')}
              className="font-heading text-sm sm:text-base font-black tracking-tight uppercase group shrink-0 cursor-pointer flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              <span className="text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                SALBAR <span className="text-[var(--accent-primary)] font-bold text-xs">EOC</span>
              </span>
            </button>
          </div>

          {/* Center: Navigation Links with Animated Roll Effect (Skew inverted) */}
          <nav
            data-testid="screen-navigation-tabs"
            className="hidden lg:flex flex-1 justify-center items-center gap-8 xl:gap-12 skew-x-12"
            aria-label="Operations Screen Switcher"
          >
            {NAV_ITEMS.map((item) => (
              <AnimatedLink
                key={item.id}
                title={item.label}
                id={item.id}
                isActive={activeScreen === item.id}
                onClick={handleSelectScreen}
              />
            ))}
          </nav>

          {/* Right: Ambient Hardware Telemetry & Theme Toggle (Skew inverted) */}
          <div className="hidden lg:flex flex-1 justify-end items-center gap-3.5 skew-x-12">
            {/* LoRa Gateway Status */}
            <span
              data-testid="status-gateway"
              className="px-2 py-0.5 rounded-sm bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] flex items-center gap-1.5"
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
              className="px-2 py-0.5 rounded-sm bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)]"
            >
              {operatingMode === 'lora-mesh-blackout' ? 'LoRa Mesh Outage' : 'Cloud Sync'}
            </span>

            {/* Active Alerts Pill */}
            <span
              data-testid="status-alerts"
              className="px-2 py-0.5 rounded-sm bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)] text-[11px] font-mono font-semibold"
            >
              Alerts: {activeAlertCount}
            </span>

            <div className="w-px h-4 bg-[var(--border-subtle)]" />

            {/* Light / Dark Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 hover:bg-[var(--bg-surface-elevated)] rounded-sm transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Toggle Theme"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          {/* Mobile Toggle Buttons (Skew inverted) */}
          <div className="flex items-center gap-2.5 shrink-0 lg:hidden skew-x-12">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 hover:bg-[var(--bg-surface-elevated)] rounded-sm transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center justify-center p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors bg-[var(--bg-surface-elevated)] rounded-sm border border-[var(--border-subtle)] cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu with Skewed Styling */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.76, 0, 0.24, 1] }}
              className="absolute top-full mt-2.5 left-0 w-full z-50 lg:hidden"
            >
              <div className="bg-[var(--bg-surface)]/95 backdrop-blur-3xl border border-[var(--border-subtle)] rounded-sm p-5 flex flex-col gap-3.5 shadow-2xl">
                {NAV_ITEMS.map((item) => (
                  <div key={item.id} className="border-b border-[var(--border-subtle)]/50 pb-2.5">
                    <AnimatedLink
                      title={item.label}
                      id={item.id}
                      isActive={activeScreen === item.id}
                      onClick={handleSelectScreen}
                    />
                  </div>
                ))}

                {/* Mobile Telemetry Summary */}
                <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-[var(--text-secondary)]">
                  <span>COM3: {gatewayStatus}</span>
                  <span className="text-[var(--accent-primary)] font-semibold">
                    {activeAlertCount} Alerts
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

export default AmbientStatusHeader
