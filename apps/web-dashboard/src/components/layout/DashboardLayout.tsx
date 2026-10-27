import type { ReactNode } from 'react'
import type { ScreenId } from '../../types/navigation'
import { AmbientStatusHeader } from './AmbientStatusHeader'

export interface DashboardLayoutProps {
  activeScreen: ScreenId
  onSelectScreen: (screenId: ScreenId) => void
  children: ReactNode
}

export function DashboardLayout({
  activeScreen,
  onSelectScreen,
  children,
}: DashboardLayoutProps) {
  return (
    <div
      data-testid="dashboard-layout"
      className="dashboard-layout min-h-screen h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden"
    >
      <AmbientStatusHeader
        activeScreen={activeScreen}
        onSelectScreen={onSelectScreen}
      />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  )
}

export default DashboardLayout
