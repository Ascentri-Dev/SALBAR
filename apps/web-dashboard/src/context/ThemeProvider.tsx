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
      root.classList.remove('dark')
    } else {
      root.setAttribute('data-theme', 'dark')
      root.classList.add('dark')
      root.classList.remove('light')
    }
    localStorage.setItem('salbar-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('salbar-map-dark', String(isMapDark))
  }, [isMapDark])

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === 'dark' ? 'light' : 'dark'
      if (nextTheme === 'light') {
        // Switching to Light Mode: set both app and map to light mode
        setIsMapDark(false)
      } else {
        // Switching to Dark Mode: ensure map is also set to dark mode
        setIsMapDark(true)
      }
      return nextTheme
    })
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
