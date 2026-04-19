import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
