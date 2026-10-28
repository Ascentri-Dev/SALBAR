import { Plus, Minus, Crosshair, Layers, Maximize2, Minimize2, ChevronLeft } from 'lucide-react'
import type { MapTileType } from './TacticalMap'

export interface MapControlsDockProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  mapTileType: MapTileType
  onToggleTileType: () => void
  isFocusMode: boolean
  onToggleFocusMode: () => void
  onClose: () => void
  className?: string
}

export function MapControlsDock({
  onZoomIn,
  onZoomOut,
  onLocate,
  mapTileType,
  onToggleTileType,
  isFocusMode,
  onToggleFocusMode,
  onClose,
  className = '',
}: MapControlsDockProps) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-sm p-1.5 shadow-2xl text-[var(--text-primary)] select-none ${className}`.trim()}
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        className="p-2 sm:p-2.5 bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center"
      >
        <Plus className="w-4 h-4 skew-x-6" />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        className="p-2 sm:p-2.5 bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center"
      >
        <Minus className="w-4 h-4 skew-x-6" />
      </button>

      <div className="w-px h-6 bg-[var(--border-subtle)] my-auto mx-0.5" />

      {/* Locate Me (GPS) */}
      <button
        type="button"
        onClick={onLocate}
        title="Locate Me (GPS)"
        aria-label="Locate Me"
        className="p-2 sm:p-2.5 bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center"
      >
        <Crosshair className="w-4 h-4 skew-x-6" />
      </button>

      {/* Focus Mode Toggle */}
      <button
        type="button"
        onClick={onToggleFocusMode}
        title={isFocusMode ? 'Exit Focus Mode' : 'Focus Tactical Map'}
        aria-label="Toggle Focus Mode"
        className={`p-2 sm:p-2.5 backdrop-blur-md border rounded-sm transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center ${
          isFocusMode
            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface)]/90 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
        }`}
      >
        {isFocusMode ? (
          <Minimize2 className="w-4 h-4 skew-x-6" />
        ) : (
          <Maximize2 className="w-4 h-4 skew-x-6" />
        )}
      </button>

      <div className="w-px h-6 bg-[var(--border-subtle)] my-auto mx-0.5" />

      {/* Map Style Cycle: 1 vs 2 */}
      <button
        type="button"
        onClick={onToggleTileType}
        title={
          mapTileType === 'humanitarian'
            ? 'Map Style: Humanitarian OSM (Click for Standard)'
            : 'Map Style: Standard OSM (Click for Humanitarian)'
        }
        aria-label="Toggle Map Tile Style"
        className={`p-2 sm:p-2.5 backdrop-blur-md border rounded-sm transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center gap-1 ${
          mapTileType === 'humanitarian'
            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface)]/90 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
        }`}
      >
        <Layers className="w-3.5 h-3.5 skew-x-6" />
        <span className="font-mono text-[10px] font-bold skew-x-6">
          {mapTileType === 'humanitarian' ? '2' : '1'}
        </span>
      </button>

      <div className="w-px h-6 bg-[var(--border-subtle)] my-auto mx-0.5" />

      {/* Hide Controls Dock Button (Collapses Left) */}
      <button
        type="button"
        onClick={onClose}
        title="Hide Map Controls"
        aria-label="Hide Map Controls"
        className="p-2 sm:p-2.5 bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all shadow-md active:scale-95 -skew-x-6 cursor-pointer flex items-center justify-center"
      >
        <ChevronLeft className="w-4 h-4 skew-x-6" />
      </button>
    </div>
  )
}

export default MapControlsDock
