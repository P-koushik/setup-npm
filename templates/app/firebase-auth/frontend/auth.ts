import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return credential.user;
}

export async function logout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
