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
      {/* 1. Ambient Drift Glow - Warm Accent (Smooth ~75px Blur, Visible but Gentle) */}
      <motion.div
        animate={{
          x: [0, 45, -35, 0],
          y: [0, -35, 25, 0],
          scale: [1, 1.12, 0.94, 1],
          opacity: isLight ? [0.14, 0.22, 0.16, 0.14] : [0.18, 0.28, 0.20, 0.18],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full blur-[75px] pointer-events-none bg-[radial-gradient(circle,var(--accent-primary)_0%,transparent_70%)]"
      />

      {/* 2. Ambient Drift Glow - Cool Navy / Telemetry (Smooth ~75px Blur, Visible but Gentle) */}
      <motion.div
        animate={{
          x: [0, -50, 35, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.9, 1.1, 1],
          opacity: isLight ? [0.12, 0.20, 0.14, 0.12] : [0.20, 0.32, 0.24, 0.20],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-40 -right-40 w-[720px] h-[720px] rounded-full blur-[80px] pointer-events-none bg-[radial-gradient(circle,#0284c7_0%,transparent_70%)]"
      />

      {/* 3. Soft Atmospheric Vignette (smoothly frames edges without hiding texture) */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-500"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 40%, rgba(241, 245, 249, 0.45) 100%)'
            : 'radial-gradient(ellipse at center, transparent 40%, rgba(10, 15, 29, 0.5) 100%)',
        }}
      />

      {/* 4. Balanced Tactical Blueprint Grid (Crisp 1px Lines + Muted Intersection Pins) */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          backgroundImage: isLight
            ? `
              radial-gradient(circle, rgba(234, 88, 12, 0.38) 1.2px, transparent 1.2px),
              linear-gradient(to right, rgba(100, 116, 139, 0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100, 116, 139, 0.12) 1px, transparent 1px)
            `
            : `
              radial-gradient(circle, rgba(255, 107, 0, 0.48) 1.2px, transparent 1.2px),
              linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)
            `,
          backgroundSize: '32px 32px, 32px 32px, 32px 32px',
        }}
      />
    </div>
  )
}

export default TacticalBackground
