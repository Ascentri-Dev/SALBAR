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
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 ${className}`.trim()}
    >
      {/* 1. Soft Ambient Drift Glow - Warm Tactical Accent Orb */}
      <motion.div
        animate={{
          x: [0, 50, -40, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.12, 0.94, 1],
          opacity: isLight ? [0.18, 0.28, 0.2, 0.18] : [0.22, 0.34, 0.24, 0.22],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,var(--accent-primary)_0%,transparent_70%)]"
      />

      {/* 2. Soft Ambient Drift Glow - Cool Tactical Navy / Telemetry Orb */}
      <motion.div
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 45, -35, 0],
          scale: [1, 0.9, 1.1, 1],
          opacity: isLight ? [0.15, 0.24, 0.16, 0.15] : [0.25, 0.38, 0.28, 0.25],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-44 -right-44 w-[720px] h-[720px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,#0284c7_0%,transparent_70%)]"
      />

      {/* 3. Center Subtle Ambient Breather - Indigo / Cyan Wash */}
      <motion.div
        animate={{
          opacity: isLight ? [0.06, 0.12, 0.06] : [0.08, 0.16, 0.08],
          scale: [0.95, 1.06, 0.95],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(ellipse,rgba(99,102,241,0.25)_0%,transparent_70%)]"
      />

      {/* 4. Subtle Radial Vignette (soft focus towards center) */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 35%, rgba(241, 245, 249, 0.5) 100%)'
            : 'radial-gradient(ellipse at center, transparent 35%, rgba(10, 15, 29, 0.45) 100%)',
        }}
      />

      {/* 5. Crisp Tactical Engineering Blueprint Grid with Intersection Points */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          backgroundImage: isLight
            ? `
              radial-gradient(circle, rgba(234, 88, 12, 0.45) 1.5px, transparent 1.5px),
              linear-gradient(to right, rgba(100, 116, 139, 0.16) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100, 116, 139, 0.16) 1px, transparent 1px)
            `
            : `
              radial-gradient(circle, rgba(255, 107, 0, 0.6) 1.5px, transparent 1.5px),
              linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px)
            `,
          backgroundSize: '36px 36px, 36px 36px, 36px 36px',
        }}
      />
    </div>
  )
}

export default TacticalBackground
