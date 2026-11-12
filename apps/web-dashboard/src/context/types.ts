export type Theme = 'dark' | 'light'

export interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isMapDark: boolean
  toggleMapDark: () => void
  setMapDark: (dark: boolean) => void
  isNavbarOpen: boolean
  setIsNavbarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  toggleNavbar: () => void
}
