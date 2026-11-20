export interface AppEnvironment {
  readonly production: boolean;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabasePublishableKey: string;
  readonly googleClientId: string;
}

export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: 'https://umdcxcjrdyckpxomxlmi.supabase.co',
  supabaseAnonKey: 'sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD',
  supabasePublishableKey: 'sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD',
  googleClientId: '<PEGA_AQUI_TU_GOOGLE_CLIENT_ID>'
};
