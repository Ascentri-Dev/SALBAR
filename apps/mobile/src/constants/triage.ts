import { EMERGENCY_COLORS } from '../theme/tokens';
import type { IncidentCategory, IncidentUrgency } from '../types/report';

export type TileTexture = 'diamond' | 'cross' | 'waves' | 'grid' | 'stripes' | 'dots';

export interface CategoryOption {
  id: IncidentCategory;
  label: string;
  localHint: string;
  defaultUrgency: IncidentUrgency;
  accentColor: string;
  tintDark: string;
  tintLight: string;
  texture: TileTexture;
}

export const TRIAGE_CATEGORIES: CategoryOption[] = [
  {
    id: 'trapped-persons',
    label: 'Trapped Persons',
    localHint: 'Na-trap / Natabunan',
    defaultUrgency: 'LOW',
    accentColor: '#EF4444', // Crimson Red
    tintDark: 'rgba(239, 68, 68, 0.14)',
    tintLight: 'rgba(239, 68, 68, 0.08)',
    texture: 'diamond',
  },
  {
    id: 'medical-emergency',
    label: 'Medical Emerg.',
    localHint: 'Emerhensya Medikal',
    defaultUrgency: 'LOW',
    accentColor: '#8B5CF6', // Violet
    tintDark: 'rgba(139, 92, 246, 0.15)',
    tintLight: 'rgba(139, 92, 246, 0.09)',
    texture: 'cross',
  },
  {
    id: 'flood-inundation',
    label: 'Flooding',
    localHint: 'Baha / Taas Tubig',
    defaultUrgency: 'LOW',
    accentColor: '#06B6D4', // Cyan Blue
    tintDark: 'rgba(6, 182, 212, 0.14)',
    tintLight: 'rgba(6, 182, 212, 0.08)',
    texture: 'waves',
  },
  {
    id: 'structural-collapse',
    label: 'Structural Dmg',
    localHint: 'Guba nga Balay',
    defaultUrgency: 'LOW',
    accentColor: '#F59E0B', // Amber Gold
    tintDark: 'rgba(245, 158, 11, 0.14)',
    tintLight: 'rgba(245, 158, 11, 0.08)',
    texture: 'grid',
  },
  {
    id: 'landslide-hazard',
    label: 'Landslide',
    localHint: 'Dahili sa Yuta',
    defaultUrgency: 'LOW',
    accentColor: '#F97316', // Deep Orange
    tintDark: 'rgba(249, 115, 22, 0.14)',
    tintLight: 'rgba(249, 115, 22, 0.08)',
    texture: 'stripes',
  },
  {
    id: 'relief-supplies',
    label: 'Relief Supplies',
    localHint: 'Pagkaon / Tubig',
    defaultUrgency: 'LOW',
    accentColor: '#10B981', // Emerald Green
    tintDark: 'rgba(16, 185, 129, 0.14)',
    tintLight: 'rgba(16, 185, 129, 0.08)',
    texture: 'dots',
  },
];

export interface UrgencyOption {
  id: IncidentUrgency;
  label: string;
  subtitle: string;
  color: string;
  tintDark: string;
  tintLight: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  {
    id: 'LOW',
    label: 'LOW',
    subtitle: 'Minor / supply check',
    color: EMERGENCY_COLORS.low,
    tintDark: 'rgba(2, 132, 199, 0.14)',
    tintLight: 'rgba(2, 132, 199, 0.08)',
  },
  {
    id: 'MODERATE',
    label: 'MODERATE',
    subtitle: 'Needs assistance',
    color: EMERGENCY_COLORS.moderate,
    tintDark: 'rgba(245, 158, 11, 0.14)',
    tintLight: 'rgba(245, 158, 11, 0.08)',
  },
  {
    id: 'HIGH',
    label: 'HIGH',
    subtitle: 'Severe / escalating',
    color: EMERGENCY_COLORS.high,
    tintDark: 'rgba(249, 115, 22, 0.14)',
    tintLight: 'rgba(249, 115, 22, 0.08)',
  },
  {
    id: 'CRITICAL',
    label: 'CRITICAL',
    subtitle: 'Immediate life threat',
    color: EMERGENCY_COLORS.critical,
    tintDark: 'rgba(239, 68, 68, 0.18)',
    tintLight: 'rgba(239, 68, 68, 0.10)',
  },
];

export function getUrgencyColor(urgency: IncidentUrgency): string {
  switch (urgency) {
    case 'CRITICAL':
      return EMERGENCY_COLORS.critical;
    case 'HIGH':
      return EMERGENCY_COLORS.high;
    case 'MODERATE':
      return EMERGENCY_COLORS.moderate;
    case 'LOW':
      return EMERGENCY_COLORS.low;
  }
}

export function getCategoryLabel(category: IncidentCategory): string {
  return TRIAGE_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function getCategoryOption(category: IncidentCategory): CategoryOption {
  return TRIAGE_CATEGORIES.find((item) => item.id === category) ?? TRIAGE_CATEGORIES[0];
}
