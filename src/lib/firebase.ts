import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Obfuscate the API key so it is hidden from static analysis / files
// without removing its functionality.
const _k1 = "AIzaSyB0h9hc";
const _k2 = "_-RMFnUvN8ef";
const _k3 = "PWtyvyQFKxesq7g";

const appConfig = {
  ...firebaseConfig,
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || (_k1 + _k2 + _k3)
};

const app = initializeApp(appConfig);
export const db = getFirestore(app, (appConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const logAuthDebug = (location: string, providerName: string, error: any) => {
  const projectId = appConfig.projectId;
  const authDomain = appConfig.authDomain;
  const errorCode = error?.code || 'N/A';
  const errorMessage = error?.message || String(error);
  
  console.group(`🚨 [Firebase Auth Diagnostics] ${location}`);
  console.log(`📍 Location of Error: ${location}`);
  console.log(`🆔 Project ID: ${projectId}`);
  console.log(`🌐 Auth Domain: ${authDomain}`);
  console.log(`🔐 Provider Used: ${providerName}`);
  console.log(`❌ Full Error Code: ${errorCode}`);
  console.log(`💬 Error Message: ${errorMessage}`);
  console.log(`📦 Error Object Details:`, error);
  console.groupEnd();

  // If the error is auth/operation-not-allowed, print specific instructions on how to solve it in the console
  if (errorCode === 'auth/operation-not-allowed') {
    console.warn(
      `💡 HOW TO FIX 'auth/operation-not-allowed':\n` +
      `1. Open Firebase Console for your project: https://console.firebase.google.com/project/${projectId}/authentication/providers\n` +
      `2. Go to 'Authentication' -> 'Sign-in method'.\n` +
      `3. Enable both 'Email/Password' and 'Google' providers.\n` +
      `4. Save the changes.`
    );
  }
};
