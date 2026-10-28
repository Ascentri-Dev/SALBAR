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

interface StaggeredTextProps {
  text: string
  isActive?: boolean
  className?: string
  inactiveColorClass?: string
  activeColorClass?: string
  hoverColorClass?: string
}

function StaggeredText({
  text,
  isActive = false,
  className = '',
  inactiveColorClass = 'text-slate-900 font-bold',
  activeColorClass = 'text-[var(--accent-primary)] font-extrabold',
  hoverColorClass = 'group-hover:text-[var(--accent-hover)]',
}: StaggeredTextProps) {
  const characters = text.split('')

  return (
    <span className={`inline-flex items-center overflow-hidden leading-none ${className}`.trim()}>
      {characters.map((char, index) => {
        const isSpace = char === ' '

        return (
          <span
            key={index}
            className="relative inline-block overflow-hidden font-heading text-xs xl:text-sm font-bold uppercase tracking-wider select-none"
          >
            {/* Top text layer (visible when inactive, flips up when active) */}
            <motion.span
              initial={false}
              animate={isActive ? { y: '-100%' } : { y: '0%' }}
              transition={{
                duration: 0.38,
                delay: index * 0.02,
                ease: [0.76, 0, 0.24, 1],
              }}
              className={`inline-block transition-colors duration-200 ${
                isSpace ? 'w-1.5 sm:w-2' : ''
              } ${inactiveColorClass} ${hoverColorClass}`}
            >
              {isSpace ? '\u00A0' : char}
            </motion.span>

            {/* Bottom text layer (hidden below, flips into view when active) */}
            <motion.span
              initial={false}
              animate={isActive ? { y: '0%' } : { y: '100%' }}
              transition={{
                duration: 0.38,
                delay: index * 0.02,
                ease: [0.76, 0, 0.24, 1],
              }}
              className={`absolute inset-0 inline-block font-extrabold ${
                isSpace ? 'w-1.5 sm:w-2' : ''
              } ${activeColorClass}`}
            >
              {isSpace ? '\u00A0' : char}
            </motion.span>
          </span>
        )
      })}
    </span>
  )
}

interface AnimatedLinkProps {
  title: string
  id: ScreenId
  isActive?: boolean
  onClick: (id: ScreenId) => void
  isLight: boolean
}

const AnimatedLink = ({ title, id, isActive, onClick, isLight }: AnimatedLinkProps) => {
  return (
    <button
      type="button"
      data-testid={`nav-tab-${id}`}
      onClick={() => onClick(id)}
      className="group relative cursor-pointer block shrink-0 py-1"
    >
      <StaggeredText
        text={title}
        isActive={isActive}
        inactiveColorClass={isLight ? 'text-slate-900 font-bold' : 'text-slate-100 font-bold'}
        activeColorClass="text-[var(--accent-primary)] font-extrabold"
        hoverColorClass="group-hover:text-[var(--accent-hover)]"
      />
    </button>
  )
}

export function AmbientStatusHeader({
  activeScreen,
  onSelectScreen,
}: AmbientStatusHeaderProps) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { theme, toggleTheme, isMapDark } = useTheme()

  const isLight = theme === 'light'

  const handleSelectScreen = (screenId: ScreenId) => {
    setIsMobileMenuOpen(false)
    onSelectScreen(screenId)
  }

  const toggleNavbar = () => {
    setIsNavbarOpen((prev) => !prev)
    if (isMobileMenuOpen) setIsMobileMenuOpen(false)
  }

  // Adaptive high contrast for "SALBAR" text
  const getSalbarColorClasses = () => {
    if (isNavbarOpen) {
      return {
        inactive: isLight ? 'text-slate-950 font-black' : 'text-white font-black',
        active: 'text-[var(--accent-primary)] font-black',
        hover: 'group-hover:text-[var(--accent-hover)]',
      }
    }
    // When navbar is hidden, adapt directly to the underlying map theme
    if (!isMapDark) {
      // Light map -> Jet black text with subtle white halo
      return {
        inactive: 'text-slate-950 font-black',
        active: 'text-[var(--accent-primary)] font-black',
        hover: 'group-hover:text-[var(--accent-hover)]',
      }
    }
    // Dark map -> Pure white text with dark shadow
    return {
      inactive: 'text-white font-black',
      active: 'text-[var(--accent-primary)] font-black',
      hover: 'group-hover:text-[var(--accent-hover)]',
    }
  }

  const salbarColors = getSalbarColorClasses()

  return (
    <header
      data-testid="ambient-status-header"
      className="fixed top-3 sm:top-4 left-0 right-0 z-40 pointer-events-none flex justify-center px-2 sm:px-4 md:px-5 select-none w-full"
    >
      <div className="w-full relative pointer-events-none h-13 sm:h-14 flex items-center">
        {/* Full-width Solid Rounded Navbar Bar */}
        <motion.div
          initial={false}
          animate={{
            y: isNavbarOpen ? 0 : -90,
            opacity: isNavbarOpen ? 1 : 0,
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`w-full h-full flex items-center justify-between rounded-full px-6 sm:px-10 pointer-events-auto border transition-colors duration-300 shadow-2xl ${
            isLight
              ? 'bg-white border-slate-300 shadow-slate-400/25'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-black/50'
          }`}
        >
          {/* Left spacer so center links align properly leaving room for SALBAR text */}
          <div className="w-28 sm:w-32 shrink-0 pointer-events-none" />

          {/* Center: Navigation Links with Staggered Letter-by-Letter Animation */}
          <nav
            data-testid="screen-navigation-tabs"
            className="hidden lg:flex items-center gap-8 xl:gap-14"
            aria-label="Operations Screen Switcher"
          >
            {NAV_ITEMS.map((item) => (
              <AnimatedLink
                key={item.id}
                title={item.label}
                id={item.id}
                isActive={activeScreen === item.id}
                onClick={handleSelectScreen}
                isLight={isLight}
              />
            ))}
          </nav>

          {/* Right: Theme Toggle */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-800 hover:text-[var(--accent-primary)]'
                  : 'hover:bg-[var(--bg-surface-elevated)] text-slate-100 hover:text-[var(--accent-primary)]'
              }`}
              aria-label="Toggle Theme"
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {isLight ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>

          {/* Mobile Buttons */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-800 hover:text-[var(--accent-primary)]'
                  : 'hover:bg-[var(--bg-surface-elevated)] text-slate-100 hover:text-[var(--accent-primary)]'
              }`}
              aria-label="Toggle Theme"
            >
              {isLight ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-full border cursor-pointer ${
                isLight
                  ? 'bg-slate-100 text-slate-800 border-slate-300 hover:text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-elevated)] text-slate-100 border-[var(--border-subtle)] hover:text-[var(--accent-primary)]'
              }`}
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </motion.div>

        {/* Pinned "SALBAR" Text Trigger: Pure Text with Staggered Letter Wave */}
        <div className="absolute left-6 sm:left-10 top-0 bottom-0 z-50 pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={toggleNavbar}
            className={`font-heading relative group cursor-pointer text-base sm:text-lg font-black tracking-wider uppercase block shrink-0 select-none transition-all duration-300 ${
              !isNavbarOpen
                ? !isMapDark
                  ? 'drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)]'
                  : 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]'
                : ''
            }`}
            title={isNavbarOpen ? 'Click "SALBAR" to hide navbar' : 'Click "SALBAR" to reveal navbar'}
            aria-label={isNavbarOpen ? 'Hide navbar' : 'Reveal navbar'}
          >
            <StaggeredText
              text="SALBAR"
              isActive={!isNavbarOpen}
              className="text-base sm:text-lg font-black tracking-wider"
              inactiveColorClass={salbarColors.inactive}
              activeColorClass={salbarColors.active}
              hoverColorClass={salbarColors.hover}
            />
          </button>
        </div>

        {/* Mobile Dropdown Menu with Solid Styling */}
        <AnimatePresence>
          {isNavbarOpen && isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full mt-2.5 left-0 w-full z-50 lg:hidden pointer-events-auto"
            >
              <div
                className={`border rounded-2xl p-5 flex flex-col gap-3.5 shadow-2xl ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100'
                }`}
              >
                {NAV_ITEMS.map((item) => (
                  <div key={item.id} className="border-b border-slate-200 dark:border-[var(--border-subtle)]/50 pb-2.5">
                    <AnimatedLink
                      title={item.label}
                      id={item.id}
                      isActive={activeScreen === item.id}
                      onClick={handleSelectScreen}
                      isLight={isLight}
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
