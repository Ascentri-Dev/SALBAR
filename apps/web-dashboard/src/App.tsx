import { useState } from 'react'
import type { ScreenId } from './types/navigation'
import { DashboardLayout } from './components/layout'
import { CommandMapScreen, FleetManagementScreen, IncidentArchiveScreen } from './screens'
import { ThemeProvider } from './context'
import './App.css'

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('command-map')

  return (
    <ThemeProvider>
      <DashboardLayout
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
      >
        {activeScreen === 'command-map' && <CommandMapScreen />}
        {activeScreen === 'fleet-management' && (
          <FleetManagementScreen onSelectScreen={setActiveScreen} />
        )}
        {activeScreen === 'incident-archive' && <IncidentArchiveScreen />}
      </DashboardLayout>
    </ThemeProvider>
  )
}

export default App
