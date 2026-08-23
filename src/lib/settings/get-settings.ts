import "server-only";

import { cache } from "react";
import { FALLBACK_SETTINGS, SETTING_KEYS, type SettingKey } from "@/constants/default-settings";
import { createClient } from "@/lib/supabase/server";
import type { RecencyThresholds } from "@/lib/business-rules/calculate-transaction-status";
import type { SettingsMap } from "@/types/settings";

const NUMERIC_KEYS = Object.values(SETTING_KEYS) as SettingKey[];

/**
 * Carrega system_settings uma vez por requisicao e repassa para as regras.
 *
 * E o unico lugar que le parametro. As funcoes de business-rules recebem os
 * valores por argumento: e isso que as mantem puras e testaveis sem banco.
 */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("system_settings").select("key, value");

  if (error || !data) return { ...FALLBACK_SETTINGS };

  const result = { ...FALLBACK_SETTINGS };
  for (const row of data) {
    if (!NUMERIC_KEYS.includes(row.key as SettingKey)) continue;
    const parsed = Number(row.value);
    if (Number.isFinite(parsed)) result[row.key as SettingKey] = parsed;
  }
  return result;
});

export function toRecencyThresholds(settings: SettingsMap): RecencyThresholds {
  return {
    recentDays: settings.transaction_recent_days,
    attentionDays: settings.transaction_attention_days,
    actionDays: settings.transaction_action_days,
  };
}
