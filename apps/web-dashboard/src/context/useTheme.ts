import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'
import type { ThemeContextType } from './types'

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'dark',
      toggleTheme: () => {},
    }
  }
  return context
}

export default useTheme
