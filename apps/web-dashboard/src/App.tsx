import { useState, useCallback } from 'react'
import type { ScreenId } from './types/navigation'
import { DashboardLayout } from './components/layout'
import { CommandMapScreen, FleetManagementScreen, IncidentArchiveScreen } from './screens'
import { ThemeProvider } from './context'
import { INITIAL_INCIDENTS, INITIAL_RESPONDERS } from './data/mockCadData'
import type { IncidentReport, FieldResponder } from './types/cad'
import { useGatewayBridge, type LiveTelemetryUpdate } from './hooks/useGatewayBridge'
import './App.css'

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('command-map')
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)

  // Shared live LoRa telemetry handler across Command Map and Management screens
  const handleLiveTelemetry = useCallback((telemetry: LiveTelemetryUpdate) => {
    setResponders((prev) => {
      const exists = prev.some((r) => r.id === telemetry.id)
      if (!exists) {
        const newUnit: FieldResponder = {
          id: telemetry.id,
          name: `Unit ${telemetry.id}`,
          role: 'Search and Rescue',
          terminalType: 'TTGO_T_BEAM_V12',
          status: telemetry.status || 'AVAILABLE',
          batteryPercent: telemetry.batteryPercent ?? 90,
          batteryVoltage: telemetry.batteryVoltage ?? 4.0,
          fatigueScore: telemetry.fatigueScore ?? 0,
          location: {
            lat: telemetry.lat ?? 0,
            lng: telemetry.lng ?? 0,
            accuracyMeters: telemetry.accuracyMeters ?? 0,
            kalmanFiltered: telemetry.kalmanFiltered ?? false,
            gpsFix: telemetry.gpsFix ?? telemetry.lat !== undefined,
            satellites: telemetry.satellites,
            satellitesInView: telemetry.satellitesInView,
            gpsModuleOk: telemetry.gpsModuleOk,
          },
          lastSeen: 'Just now',
          relayedReportsCount: telemetry.relayedReportsCount ?? 0,
        }
        return [...prev, newUnit]
      }
      return prev.map((r) => {
        if (r.id !== telemetry.id) return r
        return {
          ...r,
          ...telemetry,
          location: {
            ...r.location,
            ...(telemetry.lat !== undefined && telemetry.lng !== undefined
              ? {
                  lat: telemetry.lat,
                  lng: telemetry.lng,
                  accuracyMeters: telemetry.accuracyMeters ?? r.location.accuracyMeters,
                  kalmanFiltered: telemetry.kalmanFiltered ?? r.location.kalmanFiltered,
                }
              : {}),
            gpsFix: telemetry.gpsFix ?? r.location.gpsFix,
            satellites: telemetry.satellites ?? r.location.satellites,
            satellitesInView: telemetry.satellitesInView ?? r.location.satellitesInView,
            gpsModuleOk: telemetry.gpsModuleOk ?? r.location.gpsModuleOk,
          },
          lastSeen: 'Just now',
        }
      })
    })
  }, [])

  const handleLiveIncident = useCallback((incomingInc: IncidentReport) => {
    setIncidents((prev) => {
      if (prev.some((i) => i.id === incomingInc.id)) return prev
      return [incomingInc, ...prev]
    })
  }, [])

  const { connectionState, sendDispatch } = useGatewayBridge(handleLiveTelemetry, handleLiveIncident)

  return (
    <ThemeProvider>
      <DashboardLayout
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
      >
        {activeScreen === 'command-map' && (
          <CommandMapScreen
            incidents={incidents}
            setIncidents={setIncidents}
            responders={responders}
            setResponders={setResponders}
            sendDispatch={sendDispatch}
          />
        )}
        {activeScreen === 'fleet-management' && (
          <FleetManagementScreen
            onSelectScreen={setActiveScreen}
            responders={responders}
            setResponders={setResponders}
            connectionState={connectionState}
          />
        )}
        {activeScreen === 'incident-archive' && <IncidentArchiveScreen />}
      </DashboardLayout>
    </ThemeProvider>
  )
}

export default App
