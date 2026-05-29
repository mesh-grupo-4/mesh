import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBB53d27zsguK48ILRtZZRp8og1KrLQqu0',
  authDomain: 'mesh-dev-6cb50.firebaseapp.com',
  projectId: 'mesh-dev-6cb50',
  storageBucket: 'mesh-dev-6cb50.firebasestorage.app',
  messagingSenderId: '470744966598',
  appId: '1:470744966598:web:f7d000b1097b9d48c57ec7',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
