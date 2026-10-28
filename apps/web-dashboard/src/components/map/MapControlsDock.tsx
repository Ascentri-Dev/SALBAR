import { Plus, Minus, Crosshair, Layers, Maximize2, Minimize2, ChevronRight, ChevronLeft } from 'lucide-react'
import type { MapTileType } from './TacticalMap'

export interface MapControlsDockProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  mapTileType: MapTileType
  onToggleTileType: () => void
  isFocusMode: boolean
  onToggleFocusMode: () => void
  isQueueOpen: boolean
  onToggleQueue: () => void
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
  isQueueOpen,
  onToggleQueue,
  className = '',
}: MapControlsDockProps) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm p-1.5 shadow-2xl text-[var(--text-primary)] select-none ${className}`.trim()}
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        className="p-2 rounded hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
      >
        <Plus size={16} />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        className="p-2 rounded hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
      >
        <Minus size={16} />
      </button>

      <div className="h-4 w-px bg-[var(--border-subtle)] my-auto" />

      {/* GPS Locate / Recenter */}
      <button
        type="button"
        onClick={onLocate}
        title="Recenter / Command Post Coordinates"
        aria-label="Recenter Map"
        className="p-2 rounded hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
      >
        <Crosshair size={16} />
      </button>

      {/* Tile Layer Switch */}
      <button
        type="button"
        onClick={onToggleTileType}
        title={`Current: ${mapTileType === 'standard' ? 'Standard OSM' : 'Humanitarian OSM'} (Click to switch)`}
        aria-label="Toggle Map Tile Style"
        className="p-2 rounded hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5 cursor-pointer font-sans"
      >
        <Layers size={15} />
        <span className="hidden sm:inline capitalize">
          {mapTileType === 'standard' ? 'Standard' : 'Humanitarian'}
        </span>
      </button>

      <div className="h-4 w-px bg-[var(--border-subtle)] my-auto" />

      {/* Focus Mode Toggle */}
      <button
        type="button"
        onClick={onToggleFocusMode}
        title={isFocusMode ? 'Exit Full Tactical Map' : 'Focus Tactical Map'}
        aria-label="Toggle Focus Mode"
        className={`p-2 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold px-2 cursor-pointer font-sans ${
          isFocusMode
            ? 'bg-[var(--accent-primary)] text-white'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]'
        }`}
      >
        {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        <span className="hidden md:inline">{isFocusMode ? 'Exit Focus' : 'Focus'}</span>
      </button>

      <div className="h-4 w-px bg-[var(--border-subtle)] my-auto" />

      {/* Dispatch Queue Toggle */}
      <button
        type="button"
        onClick={onToggleQueue}
        title={isQueueOpen ? 'Collapse Queue Panel' : 'Expand Queue Panel'}
        aria-label="Toggle Queue Panel"
        className="p-2 rounded hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 text-xs font-semibold px-2 cursor-pointer font-sans"
      >
        {isQueueOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        <span className="hidden md:inline">{isQueueOpen ? 'Hide Queue' : 'Show Queue'}</span>
      </button>
    </div>
  )
}

export default MapControlsDock

