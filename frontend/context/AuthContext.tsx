import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { syncUsuario } from '@/lib/usuariosApi';
import { API_BASE_URL } from '@/constants/Config';
export type ActividadPreferida = 'moto' | 'bici' | 'running' | 'trekking' | '';

export interface ProfileData {
  nombre: string;
  apellido: string;
  telefono: string;
  actividadPreferida: ActividadPreferida;
  photoUri: string | null;
}

interface RegisterData {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: ProfileData | null;
  backendUserId: string | null;
  backendSyncing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<ProfileData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const profileKey = (uid: string) => `mesh_profile_${uid}`;
const backendUserIdKey = 'mesh:backendUserId';

async function loadProfile(uid: string): Promise<ProfileData | null> {
  const raw = await AsyncStorage.getItem(profileKey(uid));
  return raw ? JSON.parse(raw) : null;
}

async function saveProfile(uid: string, data: ProfileData): Promise<void> {
  await AsyncStorage.setItem(profileKey(uid), JSON.stringify(data));
}

function displayNombre(profile: ProfileData | null, firebaseUser: User): string {
  const fromProfile = profile ? `${profile.nombre} ${profile.apellido}`.trim() : '';
  if (fromProfile) return fromProfile;
  return firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || 'Usuario';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [backendSyncing, setBackendSyncing] = useState(false);
  const syncAlertShown = useRef(false);

  const notifySyncFailure = useCallback((error: unknown) => {
    console.warn('Sync backend usuario falló:', error);
    if (syncAlertShown.current) return;
    syncAlertShown.current = true;
    const detail = error instanceof Error ? error.message : 'Error de red';
    Alert.alert(
      'No se pudo conectar con el servidor',
      `No pudimos sincronizar tu usuario con la base de datos.\n\n` +
        `Backend: ${API_BASE_URL}\n\n` +
        `Verificá que el backend esté corriendo (npm run dev) y que el celular esté en la misma Wi‑Fi que la PC.\n\n` +
        `Detalle: ${detail}`,
      [{ text: 'Entendido' }]
    );
  }, []);

  const syncBackendUser = useCallback(async (firebaseUser: User, storedProfile: ProfileData | null) => {
    const email = firebaseUser.email;
    if (!email) return false;

    setBackendSyncing(true);
    try {
      const nombre = displayNombre(storedProfile, firebaseUser);
      const synced = await syncUsuario(email, nombre);
      await AsyncStorage.setItem(backendUserIdKey, synced.id);
      setBackendUserId(synced.id);
      syncAlertShown.current = false;
      return true;
    } catch (e) {
      const cached = await AsyncStorage.getItem(backendUserIdKey);
      if (cached) setBackendUserId(cached);
      notifySyncFailure(e);
      return false;
    } finally {
      setBackendSyncing(false);
    }
  }, [notifySyncFailure]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      void (async () => {
        if (firebaseUser) {
          const stored = await loadProfile(firebaseUser.uid);
          setProfile(stored);
          const cachedBackendId = await AsyncStorage.getItem(backendUserIdKey);
          if (cachedBackendId) setBackendUserId(cachedBackendId);
          await syncBackendUser(firebaseUser, stored);
        } else {
          setProfile(null);
          setBackendUserId(null);
          syncAlertShown.current = false;
          await AsyncStorage.removeItem(backendUserIdKey);
        }
      })();
    });
    return unsubscribe;
  }, [syncBackendUser]);

  const login = async (email: string, password: string) => {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    const stored = await loadProfile(u.uid);
    setUser(u);
    setProfile(stored);
    await syncBackendUser(u, stored);
  };

  const register = async ({ nombre, apellido, telefono, email, password }: RegisterData) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseUpdateProfile(newUser, { displayName: `${nombre} ${apellido}` });
    const newProfile: ProfileData = {
      nombre,
      apellido,
      telefono,
      actividadPreferida: '',
      photoUri: null,
    };
    await saveProfile(newUser.uid, newProfile);
    setUser(newUser);
    setProfile(newProfile);
    await syncBackendUser(newUser, newProfile);
  };

  const logout = async () => {
    await signOut(auth);
    await AsyncStorage.removeItem(backendUserIdKey);
    setUser(null);
    setProfile(null);
    setBackendUserId(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<ProfileData>) => {
    if (!user) return;
    const updated: ProfileData = {
      ...(profile ?? { nombre: '', apellido: '', telefono: '', actividadPreferida: '', photoUri: null }),
      ...data,
    };
    await saveProfile(user.uid, updated);
    setProfile(updated);
    const displayName = `${updated.nombre} ${updated.apellido}`.trim();
    if (displayName) {
      await firebaseUpdateProfile(user, { displayName });
    }
    await syncBackendUser(user, updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profile,
        backendUserId,
        backendSyncing,
        login,
        register,
        logout,
        resetPassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
