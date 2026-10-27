export interface FleetManagementScreenProps {
  className?: string
}

export function FleetManagementScreen({ className = '' }: FleetManagementScreenProps) {
  return (
    <div
      data-testid="screen-fleet-management"
      className={`screen-fleet-management flex-1 flex flex-col p-6 overflow-y-auto ${className}`.trim()}
    >
      <header className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Field Responder Fleet Management
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Real-time terminal telemetry, fatigue indices, and operational status for deployed units.
        </p>
      </header>

      {/* Grid for Deployed Units (Unit 1 SAR, Unit 2 DA, Unit 3 Relief) */}
      <section
        data-testid="responder-units-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <div
          data-testid="unit-card-skeleton-sar"
          className="rounded border border-dashed border-[var(--border-subtle)] p-6 bg-[var(--bg-surface)] min-h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]"
        >
          [Unit 1: Search-and-Rescue (SAR) Card Skeleton]
        </div>

        <div
          data-testid="unit-card-skeleton-da"
          className="rounded border border-dashed border-[var(--border-subtle)] p-6 bg-[var(--bg-surface)] min-h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]"
        >
          [Unit 2: Damage Assessment (DA) Card Skeleton]
        </div>

        <div
          data-testid="unit-card-skeleton-relief"
          className="rounded border border-dashed border-[var(--border-subtle)] p-6 bg-[var(--bg-surface)] min-h-[260px] flex items-center justify-center text-sm text-[var(--text-secondary)]"
        >
          [Unit 3: Relief Operations Card Skeleton]
        </div>
      </section>
    </div>
  )
}

export default FleetManagementScreen
