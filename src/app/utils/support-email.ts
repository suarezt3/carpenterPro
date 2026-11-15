export const OFFICIAL_SUPPORT_EMAIL = 'piezo3dstudio@gmail.com';
export const LEGACY_SUPPORT_EMAIL = 'eydersuarez900@gmail.com';
export const SUPER_ADMIN_OWNER_EMAILS: readonly string[] = [
  'eydersuarez900@gmail.com',
  'piezo3dstudio@gmail.com'
];

/**
 * Valida si un correo pertenece a las cuentas propietarias con privilegios de SuperAdmin.
 */
export function isSuperAdminOwnerEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && SUPER_ADMIN_OWNER_EMAILS.includes(normalized);
}

/**
 * Resuelve el correo público oficial de soporte para vistas de cliente y formularios.
 * Reemplaza valores vacíos o el correo legado por `OFFICIAL_SUPPORT_EMAIL`,
 * preservando correos corporativos personalizados futuros (ej. `soporte@piezo3d.com`).
 */
export function resolvePublicSupportEmail(rawEmail: string | null | undefined): string {
  if (typeof rawEmail !== 'string') {
    return OFFICIAL_SUPPORT_EMAIL;
  }
  const trimmed = rawEmail.trim();
  if (!trimmed || trimmed.toLowerCase() === LEGACY_SUPPORT_EMAIL) {
    return OFFICIAL_SUPPORT_EMAIL;
  }
  return trimmed;
}
