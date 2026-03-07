import { getAdminContent, upsertAdminContent } from "@/lib/admin-data";

export const ADMIN_ACCESS_CONFIG_KEY = "admin_access_config";

export type AdminAccessGrant = {
  email: string;
  role: string;
  totalKp: number;
  isSuspended: boolean;
};

type AdminAccessConfig = {
  grants: AdminAccessGrant[];
};

const DEFAULT_CONFIG: AdminAccessConfig = {
  grants: []
};

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

const sanitizeGrant = (value: unknown): AdminAccessGrant | null => {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  if (!email) return null;

  const role = typeof record.role === "string" && record.role.trim() ? record.role.trim().toLowerCase() : "player";
  const parsedTotalKp =
    typeof record.totalKp === "number"
      ? Math.round(record.totalKp)
      : typeof record.total_kp === "number"
        ? Math.round(record.total_kp)
        : 20000;

  return {
    email,
    role,
    totalKp: Math.max(0, parsedTotalKp),
    isSuspended: Boolean(record.isSuspended ?? record.is_suspended ?? false)
  };
};

export async function getAdminAccessConfig(): Promise<AdminAccessConfig> {
  const raw = (await getAdminContent(ADMIN_ACCESS_CONFIG_KEY)) ?? DEFAULT_CONFIG;
  const grants = Array.isArray((raw as { grants?: unknown[] })?.grants)
    ? (raw as { grants: unknown[] }).grants.map(sanitizeGrant).filter((grant): grant is AdminAccessGrant => Boolean(grant))
    : [];

  return {
    grants
  };
}

export async function saveAdminAccessConfig(config: AdminAccessConfig) {
  const deduped = new Map<string, AdminAccessGrant>();
  for (const grant of config.grants) {
    deduped.set(normalizeEmail(grant.email), {
      email: normalizeEmail(grant.email),
      role: grant.role.trim().toLowerCase(),
      totalKp: Math.max(0, Math.round(grant.totalKp)),
      isSuspended: Boolean(grant.isSuspended)
    });
  }

  await upsertAdminContent(ADMIN_ACCESS_CONFIG_KEY, {
    grants: Array.from(deduped.values()).sort((left, right) => left.email.localeCompare(right.email))
  });
}

export async function upsertAdminAccessGrant(grant: AdminAccessGrant) {
  const config = await getAdminAccessConfig();
  const nextGrants = config.grants.filter((entry) => normalizeEmail(entry.email) !== normalizeEmail(grant.email));
  nextGrants.push({
    email: normalizeEmail(grant.email),
    role: grant.role.trim().toLowerCase(),
    totalKp: Math.max(0, Math.round(grant.totalKp)),
    isSuspended: Boolean(grant.isSuspended)
  });
  await saveAdminAccessConfig({ grants: nextGrants });
}

export async function removeAdminAccessGrant(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const config = await getAdminAccessConfig();
  await saveAdminAccessConfig({
    grants: config.grants.filter((entry) => normalizeEmail(entry.email) !== normalizedEmail)
  });
}

export async function getAdminAccessGrantByEmail(email?: string | null) {
  if (!email) return null;
  const normalizedEmail = normalizeEmail(email);
  const config = await getAdminAccessConfig();
  return config.grants.find((entry) => normalizeEmail(entry.email) === normalizedEmail) ?? null;
}
