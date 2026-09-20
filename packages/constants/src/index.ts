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
  orange: '#F58220',
  surface: '#FFFFFF',
  background: '#F5F8FC',
  text: '#10294F',
  secondaryText: '#475569',
} as const;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
