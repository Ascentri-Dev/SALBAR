import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'
import type { ThemeContextType } from './types'

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'dark',
      toggleTheme: () => {},
      isMapDark: true,
      toggleMapDark: () => {},
      setMapDark: () => {},
      isNavbarOpen: true,
      setIsNavbarOpen: () => {},
      toggleNavbar: () => {},
    }
  }
  return context
}

export default useTheme
