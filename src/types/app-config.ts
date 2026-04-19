export interface AppConfig {
  provider: 'firebase-auth' | 'supabase';
  target: 'frontend' | 'backend';
  frontendPlatform?: 'web' | 'mobile';
}
