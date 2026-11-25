/**
 * SALBAR Resident Mobile Design Tokens
 * Aligned with docs/specs/web-dashboard-ui-plan.md and docs/specs/mobile-app-plan.md.
 */

export interface ThemePalette {
  bgBase: string;
  bgSurface: string;
  bgSurfaceElevated: string;
  borderSubtle: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentHover: string;
  accentSubtle: string;
}

export const DARK_PALETTE: ThemePalette = {
  bgBase: '#0A0F1D',
  bgSurface: '#111C38',
  bgSurfaceElevated: '#18264B',
  borderSubtle: '#1F2E5C',
  borderFocus: '#334B85',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accentPrimary: '#FF6B00',
  accentHover: '#FF8533',
  accentSubtle: 'rgba(255, 107, 0, 0.12)',
};

export const LIGHT_PALETTE: ThemePalette = {
  bgBase: '#F1F5F9',
  bgSurface: '#FFFFFF',
  bgSurfaceElevated: '#E2E8F0',
  borderSubtle: '#CBD5E1',
  borderFocus: '#94A3B8',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accentPrimary: '#EA580C',
  accentHover: '#C2410C',
  accentSubtle: 'rgba(234, 88, 12, 0.10)',
};

export const EMERGENCY_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  moderate: '#F59E0B',
  low: '#0284C7',
  success: '#10B981',
  telemetry: '#06B6D4',
} as const;

export const RADII = {
  card: 16,
  control: 12,
  pill: 9999,
} as const;
