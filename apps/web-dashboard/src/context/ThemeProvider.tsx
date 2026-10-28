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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
