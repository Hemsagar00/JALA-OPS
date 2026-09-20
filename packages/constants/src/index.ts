export const ROLES = [
  'OPERATOR',
  'TECHNICIAN',
  'AE',
  'DE',
  'EE',
  'SE',
  'COLLECTOR',
  'SYSTEM_ADMIN',
] as const;
export const PUMP_STATUSES = ['STOPPED', 'RUNNING', 'BREAKDOWN', 'MAINTENANCE'] as const;
export const BRAND = {
  name: 'JALA-OPS',
  district: 'Sri Sathya Sai District, Andhra Pradesh',
  navy: '#0A2B66',
  deepNavy: '#071D45',
  orange: '#F58220',
  waterBlue: '#168BFF',
  lightBlue: '#EAF4FF',
  surface: '#FFFFFF',
  background: '#F5F8FC',
  text: '#10294F',
  secondaryText: '#475569',
  muted: '#718096',
  border: '#E2E8F0',
  success: '#18A558',
  warning: '#F4A300',
  critical: '#D9343B',
  offline: '#7B8794',
} as const;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
