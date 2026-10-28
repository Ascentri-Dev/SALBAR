import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import type { Theme } from './types'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salbar-theme') as Theme
      if (saved === 'light' || saved === 'dark') return saved
    }
    return 'dark'
  })

  const [isMapDark, setIsMapDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salbar-map-dark')
      if (saved !== null) return saved === 'true'
    }
    return true
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
      root.classList.add('light')
    } else {
      root.removeAttribute('data-theme')
      root.classList.remove('light')
    }
    localStorage.setItem('salbar-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('salbar-map-dark', String(isMapDark))
  }, [isMapDark])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const toggleMapDark = () => {
    setIsMapDark((prev) => !prev)
  }

  const setMapDark = (dark: boolean) => {
    setIsMapDark(dark)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        isMapDark,
        toggleMapDark,
        setMapDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
