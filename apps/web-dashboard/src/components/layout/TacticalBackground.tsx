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
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`.trim()}
    >
      {/* 1. Tactical Ambient Drift Glow - Warm Accent / Radar Hue */}
      <motion.div
        animate={{
          x: [0, 50, -40, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.15, 0.92, 1],
          opacity: isLight ? [0.22, 0.35, 0.25, 0.22] : [0.32, 0.48, 0.36, 0.32],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,var(--accent-primary)_0%,transparent_70%)]"
      />

      {/* 2. Tactical Ambient Drift Glow - Cool Navy / Telemetry Hue */}
      <motion.div
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 45, -35, 0],
          scale: [1, 0.88, 1.12, 1],
          opacity: isLight ? [0.18, 0.3, 0.2, 0.18] : [0.35, 0.52, 0.4, 0.35],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-44 -right-44 w-[750px] h-[750px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle,#0284c7_0%,transparent_70%)]"
      />

      {/* 3. Center Subtle Ambient Breather - Indigo / Cyan Wash */}
      <motion.div
        animate={{
          opacity: isLight ? [0.08, 0.15, 0.08] : [0.1, 0.2, 0.1],
          scale: [0.95, 1.06, 0.95],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(ellipse,rgba(99,102,241,0.25)_0%,transparent_70%)]"
      />

      {/* 4. Soft Vignette Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 35%, rgba(241, 245, 249, 0.4) 100%)'
            : 'radial-gradient(ellipse at center, transparent 35%, rgba(10, 15, 29, 0.4) 100%)',
        }}
      />

      {/* 5. Crisp Tactical Engineering Blueprint Grid with Intersection Points */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          backgroundImage: isLight
            ? `
              radial-gradient(circle, rgba(234, 88, 12, 0.6) 1.5px, transparent 1.5px),
              linear-gradient(to right, rgba(100, 116, 139, 0.22) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100, 116, 139, 0.22) 1px, transparent 1px)
            `
            : `
              radial-gradient(circle, rgba(255, 107, 0, 0.85) 1.5px, transparent 1.5px),
              linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.22) 1px, transparent 1px)
            `,
          backgroundSize: '36px 36px, 36px 36px, 36px 36px',
        }}
      />
    </div>
  )
}

export default TacticalBackground
