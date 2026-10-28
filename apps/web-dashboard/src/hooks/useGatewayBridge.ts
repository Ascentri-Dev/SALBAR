import { useState, useEffect, useRef, useCallback } from 'react'
import type { IncidentReport, ResponderStatus } from '../types/cad'

export interface LiveTelemetryUpdate {
  id: string
  lat?: number
  lng?: number
  accuracyMeters?: number
  kalmanFiltered?: boolean
  batteryVoltage?: number
  batteryPercent?: number
  status?: ResponderStatus
  fatigueScore?: number
  relayedReportsCount?: number
}

export interface GatewayConnectionState {
  isConnected: boolean
  port: string
  lastPacketTime: Date | null
}

export function useGatewayBridge(
  onTelemetryReceived?: (telemetry: LiveTelemetryUpdate) => void,
  onIncidentReceived?: (incident: IncidentReport) => void
) {
  const [connectionState, setConnectionState] = useState<GatewayConnectionState>({
    isConnected: false,
    port: 'DISCONNECTED',
    lastPacketTime: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:8080')
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionState((prev) => ({
          ...prev,
          isConnected: true,
        }))
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const now = new Date()

          if (payload.type === 'GATEWAY_STATUS') {
            setConnectionState({
              isConnected: Boolean(payload.connected),
              port: payload.port || 'UNKNOWN',
              lastPacketTime: now,
            })
          } else if (payload.type === 'TELEMETRY' && payload.data) {
            setConnectionState((prev) => ({ ...prev, lastPacketTime: now }))
            if (onTelemetryReceived) {
              onTelemetryReceived({
                id: payload.data.id || payload.srcNode,
                lat: payload.data.lat,
                lng: payload.data.lng,
                accuracyMeters: payload.data.accuracyMeters,
                batteryVoltage: payload.data.batteryVoltage,
                batteryPercent: payload.data.batteryPercent,
                fatigueScore: payload.data.fatigueScore,
                status: payload.data.status,
                relayedReportsCount: payload.data.relayedReportsCount,
              })
            }
          } else if (payload.type === 'INCIDENT' && payload.data) {
            setConnectionState((prev) => ({ ...prev, lastPacketTime: now }))
            if (onIncidentReceived) {
              const inc: IncidentReport = {
                id: payload.data.id || `INC-${Date.now().toString().slice(-4)}`,
                timestamp: now.toLocaleTimeString(),
                reportedAt: now,
                source: payload.data.source || 'LORA_DIRECT',
                rawText: payload.data.rawText || '',
                detectedLanguage: 'Cebuano',
                category: payload.data.category || 'trapped-persons',
                urgency: payload.data.urgency || 'HIGH',
                location: {
                  name: `Site ${payload.srcNode || 'LoRa Node'}`,
                  lat: payload.data.lat || 10.315,
                  lng: payload.data.lng || 123.885,
                },
                victimCount: payload.data.victimCount || 0,
                aiBriefing: `Field transmission received via gateway from terminal ${payload.srcNode || 'UNKNOWN'}.`,
                recommendedUnitId: payload.srcNode || 'SAR-01',
                status: 'UNASSIGNED',
              }
              onIncidentReceived(inc)
            }
          }
        } catch (err) {
          console.warn('[SALBAR Gateway Hook] Failed to parse WebSocket packet:', err)
        }
      }

      ws.onclose = () => {
        setConnectionState((prev) => ({
          ...prev,
          isConnected: false,
        }))
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, 4000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect()
      }, 4000)
    }
  }, [onTelemetryReceived, onIncidentReceived])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendDispatch = useCallback(
    (targetUnit: string, incidentId: string, notes?: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const numId = parseInt(incidentId.replace(/\D/g, ''), 10) || 1
        wsRef.current.send(
          JSON.stringify({
            cmd: 'DISPATCH',
            targetUnit,
            incidentIdNum: numId,
            actionCode: 0,
            notes: notes || 'Proceed to coordinate',
          })
        )
      }
    },
    []
  )

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: 'PING' }))
    }
  }, [])

  return {
    connectionState,
    sendDispatch,
    sendPing,
  }
}
