import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import config from "../../firebase-applet-config.json";

// Extract the required properties for initializeApp
export const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true
}, config.firestoreDatabaseId);

/**
 * Creates an authorized user credential in Firebase Auth without logging out the current admin.
 * It uses a temporary secondary Firebase App instance and deletes it right after creation.
 */
export async function createStaffUserAccount(email: string, pass: string) {
  const { initializeApp: initSecondaryApp, deleteApp } = await import('firebase/app');
  const { getAuth: getSecondaryAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
  
  const secondaryAppName = `AdminUserCreator_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initSecondaryApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getSecondaryAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await signOut(secondaryAuth);
    return userCredential.user;
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch (e) {
      console.warn("Could not delete secondary app:", e);
    }
  }
}

