import type { Role } from "./roles";

export const SETTING_KEYS = {
  TRANSACTION_RECENT_DAYS: "transaction_recent_days",
  TRANSACTION_ATTENTION_DAYS: "transaction_attention_days",
  TRANSACTION_ACTION_DAYS: "transaction_action_days",
  VISIT_RESERVATION_MINUTES: "visit_reservation_minutes",
  CHECKIN_RADIUS_METERS: "checkin_radius_meters",
  CONSULTANT_LOCATION_UPDATE_SECONDS: "consultant_location_update_seconds",
  MAXIMUM_ACTIVE_RESERVATIONS: "maximum_active_reservations",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/**
 * Ultimo recurso, usado apenas quando system_settings esta inacessivel.
 * O valor corrente vem SEMPRE do banco: nao ler daqui em componente.
 */
export const FALLBACK_SETTINGS: Record<SettingKey, number> = {
  transaction_recent_days: 30,
  transaction_attention_days: 60,
  transaction_action_days: 90,
  visit_reservation_minutes: 60,
  checkin_radius_meters: 200,
  consultant_location_update_seconds: 60,
  maximum_active_reservations: 3,
};

export const SETTING_MIN_ROLE: Record<SettingKey, Role> = {
  transaction_recent_days: "gestor_master",
  transaction_attention_days: "gestor_master",
  transaction_action_days: "gestor_master",
  visit_reservation_minutes: "administrativo",
  checkin_radius_meters: "administrativo",
  consultant_location_update_seconds: "administrativo",
  maximum_active_reservations: "administrativo",
};
