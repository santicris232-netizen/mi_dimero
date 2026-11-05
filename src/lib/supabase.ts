import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Bloquea por seguridad cualquier clave privada (service_role / secret) puesta por error en el frontend. */
function isPrivateKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

let client: SupabaseClient | null = null;
export let configError: string | null = null;

if (url && key && !url.includes('TU-PROYECTO')) {
  if (isPrivateKey(key)) {
    configError = 'Se detectó una clave privada de Supabase en el frontend. Usa solo la clave pública (anon).';
    console.error(configError);
  } else {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
}

export const supabase = client;
export const isCloud = client !== null;
