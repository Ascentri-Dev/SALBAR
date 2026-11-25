import { EMERGENCY_COLORS } from '../theme/tokens';
import type { IncidentCategory, IncidentUrgency } from '../types/report';

export interface CategoryOption {
  id: IncidentCategory;
  tag: string;
  label: string;
  localHint: string;
  defaultUrgency: IncidentUrgency;
  accentColor: string;
  tintDark: string;
  tintLight: string;
}

export const TRIAGE_CATEGORIES: CategoryOption[] = [
  {
    id: 'trapped-persons',
    tag: 'RESCUE',
    label: 'Trapped Persons',
    localHint: 'Na-trap / Natabunan',
    defaultUrgency: 'CRITICAL',
    accentColor: '#EF4444',
    tintDark: 'rgba(239, 68, 68, 0.14)',
    tintLight: 'rgba(239, 68, 68, 0.09)',
  },
  {
    id: 'medical-emergency',
    tag: 'MEDICAL',
    label: 'Medical Emerg.',
    localHint: 'Emerhensya Medikal',
    defaultUrgency: 'CRITICAL',
    accentColor: '#F43F5E',
    tintDark: 'rgba(244, 63, 94, 0.14)',
    tintLight: 'rgba(244, 63, 94, 0.09)',
  },
  {
    id: 'flood-inundation',
    tag: 'FLOOD',
    label: 'Flooding',
    localHint: 'Baha / Taas Tubig',
    defaultUrgency: 'HIGH',
    accentColor: '#06B6D4',
    tintDark: 'rgba(6, 182, 212, 0.14)',
    tintLight: 'rgba(6, 182, 212, 0.09)',
  },
  {
    id: 'structural-collapse',
    tag: 'STRUCTURAL',
    label: 'Structural Dmg',
    localHint: 'Guba nga Balay',
    defaultUrgency: 'HIGH',
    accentColor: '#F59E0B',
    tintDark: 'rgba(245, 158, 11, 0.14)',
    tintLight: 'rgba(245, 158, 11, 0.09)',
  },
  {
    id: 'landslide-hazard',
    tag: 'LANDSLIDE',
    label: 'Landslide',
    localHint: 'Dahili sa Yuta',
    defaultUrgency: 'HIGH',
    accentColor: '#F97316',
    tintDark: 'rgba(249, 115, 22, 0.14)',
    tintLight: 'rgba(249, 115, 22, 0.09)',
  },
  {
    id: 'relief-supplies',
    tag: 'RELIEF',
    label: 'Relief Supplies',
    localHint: 'Pagkaon / Tubig',
    defaultUrgency: 'MODERATE',
    accentColor: '#10B981',
    tintDark: 'rgba(16, 185, 129, 0.14)',
    tintLight: 'rgba(16, 185, 129, 0.09)',
  },
];

export interface UrgencyOption {
  id: IncidentUrgency;
  label: string;
  color: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { id: 'CRITICAL', label: 'CRITICAL', color: EMERGENCY_COLORS.critical },
  { id: 'HIGH', label: 'HIGH', color: EMERGENCY_COLORS.high },
  { id: 'MODERATE', label: 'MODERATE', color: EMERGENCY_COLORS.moderate },
  { id: 'LOW', label: 'LOW', color: EMERGENCY_COLORS.low },
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
