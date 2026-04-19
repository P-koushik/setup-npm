import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
