import { useState } from 'react'
import { Menu, X, Sun, Moon, ChevronDown } from 'lucide-react'
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
      className="font-heading relative overflow-hidden group cursor-pointer text-xs xl:text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] block shrink-0 transition-colors"
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
}: AmbientStatusHeaderProps) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const handleSelectScreen = (screenId: ScreenId) => {
    setIsMobileMenuOpen(false)
    onSelectScreen(screenId)
  }

  const toggleNavbar = () => {
    setIsNavbarOpen((prev) => !prev)
    if (isMobileMenuOpen) setIsMobileMenuOpen(false)
  }

  return (
    <header
      data-testid="ambient-status-header"
      className="fixed top-3 sm:top-4 left-0 right-0 z-40 pointer-events-none flex justify-center px-4 md:px-6 select-none"
    >
      <div className="w-full max-w-5xl relative pointer-events-none h-12">
        {/* Main Floating Rounded Navbar Container */}
        <motion.div
          initial={false}
          animate={{
            y: isNavbarOpen ? 0 : -80,
            opacity: isNavbarOpen ? 1 : 0,
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full flex items-center justify-between bg-[var(--bg-surface)]/90 backdrop-blur-2xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl shadow-black/25 px-4 sm:px-6 pointer-events-auto"
        >
          {/* Left spacer so center links align properly leaving room for the pinned SALBAR logo */}
          <div className="w-28 sm:w-32 shrink-0 pointer-events-none" />

          {/* Center: Navigation Links with Animated Roll Effect */}
          <nav
            data-testid="screen-navigation-tabs"
            className="hidden lg:flex items-center gap-8 xl:gap-12"
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

          {/* Right: Theme Toggle */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Toggle Theme"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          {/* Mobile Toggle Buttons */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </motion.div>

        {/* Pinned SALBAR Brand Trigger: Stays at the Exact Same X & Y Position */}
        <div className="absolute left-0 top-0 h-full z-50 pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={toggleNavbar}
            className={`h-full flex items-center gap-2 px-4 sm:px-5 rounded-2xl transition-all duration-300 cursor-pointer font-heading font-black text-base sm:text-lg tracking-wider uppercase select-none ${
              isNavbarOpen
                ? 'text-[var(--text-primary)] hover:text-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)]/95 backdrop-blur-2xl border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] shadow-2xl ring-1 ring-[var(--border-subtle)]'
            }`}
            title={isNavbarOpen ? 'Click "SALBAR" to hide navbar' : 'Click "SALBAR" to reveal navbar'}
            aria-label={isNavbarOpen ? 'Hide navbar' : 'Reveal navbar'}
          >
            <span>SALBAR</span>
            {!isNavbarOpen && (
              <ChevronDown size={14} className="text-[var(--accent-primary)] animate-bounce" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu with Rounded Corners */}
        <AnimatePresence>
          {isNavbarOpen && isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full mt-2.5 left-0 w-full z-50 lg:hidden pointer-events-auto"
            >
              <div className="bg-[var(--bg-surface)]/95 backdrop-blur-3xl border border-[var(--border-subtle)] rounded-2xl p-5 flex flex-col gap-3.5 shadow-2xl">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

export default AmbientStatusHeader
