import { EMERGENCY_COLORS } from '../theme/tokens';
import type { IncidentCategory, IncidentUrgency } from '../types/report';

export interface CategoryOption {
  id: IncidentCategory;
  label: string;
  localHint: string;
  defaultUrgency: IncidentUrgency;
}

export const TRIAGE_CATEGORIES: CategoryOption[] = [
  {
    id: 'trapped-persons',
    label: 'Trapped Persons',
    localHint: 'Na-trap / Natabunan',
    defaultUrgency: 'CRITICAL',
  },
  {
    id: 'medical-emergency',
    label: 'Medical Emerg.',
    localHint: 'Emerhensya Medikal',
    defaultUrgency: 'CRITICAL',
  },
  {
    id: 'flood-inundation',
    label: 'Flooding',
    localHint: 'Baha / Taas Tubig',
    defaultUrgency: 'HIGH',
  },
  {
    id: 'structural-collapse',
    label: 'Structural Dmg',
    localHint: 'Guba nga Balay',
    defaultUrgency: 'HIGH',
  },
  {
    id: 'landslide-hazard',
    label: 'Landslide',
    localHint: 'Dahili sa Yuta',
    defaultUrgency: 'HIGH',
  },
  {
    id: 'relief-supplies',
    label: 'Relief Supplies',
    localHint: 'Pagkaon / Tubig',
    defaultUrgency: 'MODERATE',
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
