import {
  LEGACY_SUPPORT_EMAIL,
  OFFICIAL_SUPPORT_EMAIL,
  SUPER_ADMIN_OWNER_EMAILS,
  isSuperAdminOwnerEmail,
  resolvePublicSupportEmail
} from './support-email';

describe('support-email utils', () => {
  it('debe exponer las constantes oficiales de soporte y propietarios SuperAdmin', () => {
    expect(OFFICIAL_SUPPORT_EMAIL).toBe('piezo3dstudio@gmail.com');
    expect(LEGACY_SUPPORT_EMAIL).toBe('eydersuarez900@gmail.com');
    expect(SUPER_ADMIN_OWNER_EMAILS).toEqual([
      'eydersuarez900@gmail.com',
      'piezo3dstudio@gmail.com'
    ]);
  });

  it('isSuperAdminOwnerEmail debe validar ambas cuentas propietarias normalizando espacios y mayúsculas', () => {
    expect(isSuperAdminOwnerEmail('eydersuarez900@gmail.com')).toBe(true);
    expect(isSuperAdminOwnerEmail('  EyderSuarez900@GMAIL.com  ')).toBe(true);
    expect(isSuperAdminOwnerEmail('piezo3dstudio@gmail.com')).toBe(true);
    expect(isSuperAdminOwnerEmail('  PIEZO3DSTUDIO@GMAIL.COM  ')).toBe(true);

    expect(isSuperAdminOwnerEmail('usuario@taller.com')).toBe(false);
    expect(isSuperAdminOwnerEmail('')).toBe(false);
    expect(isSuperAdminOwnerEmail('   ')).toBe(false);
    expect(isSuperAdminOwnerEmail(null)).toBe(false);
    expect(isSuperAdminOwnerEmail(undefined)).toBe(false);
  });

  it('resolvePublicSupportEmail debe retornar piezo3dstudio@gmail.com ante vacío o legado y conservar personalizaciones', () => {
    expect(resolvePublicSupportEmail(undefined)).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail(null)).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('')).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('   ')).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('eydersuarez900@gmail.com')).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('  EYDERSUAREZ900@GMAIL.COM  ')).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('piezo3dstudio@gmail.com')).toBe('piezo3dstudio@gmail.com');
    expect(resolvePublicSupportEmail('  soporte@piezo3d.com  ')).toBe('soporte@piezo3d.com');
  });
});
