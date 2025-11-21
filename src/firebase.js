import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCc6KOYodPY6qiZWQquFnTHTworacRWOzw",
  authDomain: "lcup-foodie-841a6.firebaseapp.com",
  projectId: "lcup-foodie-841a6",
  storageBucket: "lcup-foodie-841a6.firebasestorage.app",
  messagingSenderId: "929595441335",
  appId: "1:929595441335:web:c1c37517e809e5b5af0d32",
  measurementId: "G-N6JNCXNPS8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;