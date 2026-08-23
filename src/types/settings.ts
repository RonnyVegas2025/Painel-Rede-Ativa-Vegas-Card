import type { Role } from "@/constants/roles";
import type { SettingKey } from "@/constants/default-settings";

export interface SystemSetting {
  key: SettingKey;
  value: number | string | boolean;
  valueType: "integer" | "decimal" | "boolean" | "string";
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  description: string;
  minRole: Role;
  updatedBy: string | null;
  updatedAt: string;
}

export type SettingsMap = Record<SettingKey, number>;
