import { Plus, Minus, Crosshair, Layers, Maximize2, Minimize2, ChevronLeft, Sun, Moon } from 'lucide-react'
import type { MapTileType } from './TacticalMap'
import { useTheme } from '../../context'

export interface MapControlsDockProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  mapTileType: MapTileType
  onToggleTileType: () => void
  isMapDark: boolean
  onToggleMapDark: () => void
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
  isMapDark,
  onToggleMapDark,
  isFocusMode,
  onToggleFocusMode,
  onClose,
  className = '',
}: MapControlsDockProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div
      className={`pointer-events-auto h-13 sm:h-14 flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 shadow-2xl select-none border transition-colors duration-300 ${
        isLight
          ? 'bg-white border-slate-300 shadow-slate-300/40 text-slate-900'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-black/50 text-slate-100'
      } ${className}`.trim()}
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isLight
            ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white text-slate-800'
            : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white text-slate-200'
        }`}
      >
        <Plus size={16} />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isLight
            ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white text-slate-800'
            : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white text-slate-200'
        }`}
      >
        <Minus size={16} />
      </button>

      <div className={`w-px h-5 my-auto ${isLight ? 'bg-slate-200' : 'bg-[var(--border-subtle)]'}`} />

      {/* Locate Me (GPS) */}
      <button
        type="button"
        onClick={onLocate}
        title="Locate Me (GPS)"
        aria-label="Locate Me"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isLight
            ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white text-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white text-[var(--accent-primary)]'
        }`}
      >
        <Crosshair size={16} />
      </button>

      {/* Focus Mode Toggle */}
      <button
        type="button"
        onClick={onToggleFocusMode}
        title={isFocusMode ? 'Exit Focus Mode' : 'Focus Tactical Map'}
        aria-label="Toggle Focus Mode"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isFocusMode
            ? 'bg-[var(--accent-primary)] text-white'
            : isLight
              ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white text-slate-800'
              : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white text-slate-200'
        }`}
      >
        {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <div className={`w-px h-5 my-auto ${isLight ? 'bg-slate-200' : 'bg-[var(--border-subtle)]'}`} />

      {/* Map Tile Style Toggle */}
      <button
        type="button"
        onClick={onToggleTileType}
        title={
          mapTileType === 'humanitarian'
            ? 'Map Style: Humanitarian OSM (Click for Standard)'
            : 'Map Style: Standard OSM (Click for Humanitarian)'
        }
        aria-label="Toggle Map Tile Style"
        className={`h-9 sm:h-10 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer text-xs font-bold ${
          mapTileType === 'humanitarian'
            ? 'bg-[var(--accent-primary)] text-white'
            : isLight
              ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white text-slate-800'
              : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white text-slate-200'
        }`}
      >
        <Layers size={14} />
        <span className="font-mono text-[10px]">{mapTileType === 'humanitarian' ? '2' : '1'}</span>
      </button>

      <div className={`w-px h-5 my-auto ${isLight ? 'bg-slate-200' : 'bg-[var(--border-subtle)]'}`} />

      {/* Map Dark / Light Mode Toggle */}
      <button
        type="button"
        onClick={onToggleMapDark}
        title={isMapDark ? 'Map: Dark Mode (Click for Light Mode)' : 'Map: Light Mode (Click for Dark Mode)'}
        aria-label="Toggle Map Dark Mode"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isMapDark
            ? isLight
              ? 'bg-slate-100 text-amber-500 hover:bg-[var(--accent-primary)] hover:text-white'
              : 'bg-[var(--bg-surface-elevated)] text-amber-400 hover:bg-[var(--accent-primary)] hover:text-white'
            : 'bg-[var(--accent-primary)] text-white'
        }`}
      >
        {isMapDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className={`w-px h-5 my-auto ${isLight ? 'bg-slate-200' : 'bg-[var(--border-subtle)]'}`} />

      {/* Hide Controls Dock Button (Collapses Left) */}
      <button
        type="button"
        onClick={onClose}
        title="Hide Map Controls"
        aria-label="Hide Map Controls"
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer ${
          isLight
            ? 'bg-slate-100 text-slate-600 hover:text-[var(--accent-primary)] hover:bg-slate-200'
            : 'bg-[var(--bg-surface-elevated)] text-slate-400 hover:text-[var(--accent-primary)] hover:bg-[var(--border-subtle)]'
        }`}
      >
        <ChevronLeft size={16} />
      </button>
    </div>
  )
}

export default MapControlsDock
