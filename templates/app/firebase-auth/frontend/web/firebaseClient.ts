import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);

export { firebaseApp, firebaseAuth };
