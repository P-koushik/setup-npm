import cicdPlugin from './cicd/index.js';
import firebaseAuthPlugin from './firebase-auth/index.js';
import supabasePlugin from './supabase/index.js';

export const plugins = {
  cicd: cicdPlugin,
  'firebase-auth': firebaseAuthPlugin,
  supabase: supabasePlugin
};
