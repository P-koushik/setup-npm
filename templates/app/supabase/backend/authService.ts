import { supabaseAdmin } from './supabaseServer';

export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw error;
  }

  return data.user;
}

export async function listUsers(page = 1, perPage = 50) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page,
    perPage
  });

  if (error) {
    throw error;
  }

  return data.users;
}
