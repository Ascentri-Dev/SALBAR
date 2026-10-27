import { useState } from 'react'
import type { ScreenId } from './types/navigation'
import { DashboardLayout } from './components/layout'
import { CommandMapScreen, FleetManagementScreen, IncidentArchiveScreen } from './screens'
import './App.css'

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('command-map')

  return (
    <DashboardLayout
      activeScreen={activeScreen}
      onSelectScreen={setActiveScreen}
    >
      {activeScreen === 'command-map' && <CommandMapScreen />}
      {activeScreen === 'fleet-management' && <FleetManagementScreen />}
      {activeScreen === 'incident-archive' && <IncidentArchiveScreen />}
    </DashboardLayout>
  )
}

export default App
