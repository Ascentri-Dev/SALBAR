import { motion } from 'framer-motion'
import { useTheme } from '../../context'

export interface TacticalBackgroundProps {
  className?: string
}

export function TacticalBackground({ className = '' }: TacticalBackgroundProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div
      aria-hidden="true"
      data-testid="tactical-background"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`.trim()}
    >
      {/* 1. Tactical Micro Dot Grid Texture */}
      <div
        className="absolute inset-0 opacity-100 transition-opacity duration-500"
        style={{
          backgroundImage: isLight
            ? 'radial-gradient(rgba(100, 116, 139, 0.16) 1.2px, transparent 1.2px)'
            : 'radial-gradient(rgba(148, 163, 184, 0.13) 1.2px, transparent 1.2px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* 2. Soft Ambient Drift Glow - Warm Tactical Accent */}
      <motion.div
        animate={{
          x: [0, 45, -35, 0],
          y: [0, -35, 25, 0],
          scale: [1, 1.1, 0.95, 1],
          opacity: isLight ? [0.14, 0.22, 0.15, 0.14] : [0.08, 0.15, 0.09, 0.08],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-36 -left-36 w-[620px] h-[620px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,var(--accent-primary)_0%,transparent_70%)]"
      />

      {/* 3. Soft Ambient Drift Glow - Cool Tactical Navy / Telemetry */}
      <motion.div
        animate={{
          x: [0, -50, 35, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.92, 1.08, 1],
          opacity: isLight ? [0.12, 0.18, 0.13, 0.12] : [0.12, 0.19, 0.14, 0.12],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-48 -right-48 w-[680px] h-[680px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,#0284c7_0%,transparent_70%)]"
      />

      {/* 4. Center Subtle Breather - Indigo Wash */}
      <motion.div
        animate={{
          opacity: isLight ? [0.03, 0.07, 0.03] : [0.03, 0.08, 0.03],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(ellipse,rgba(99,102,241,0.2)_0%,transparent_70%)]"
      />

      {/* 5. Depth Radial Vignette (soft focus towards center content) */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 35%, rgba(241, 245, 249, 0.65) 100%)'
            : 'radial-gradient(ellipse at center, transparent 35%, rgba(10, 15, 29, 0.8) 100%)',
        }}
      />
    </div>
  )
}

export default TacticalBackground

