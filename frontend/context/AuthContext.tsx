import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';

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
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<ProfileData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const profileKey = (uid: string) => `mesh_profile_${uid}`;

async function loadProfile(uid: string): Promise<ProfileData | null> {
  const raw = await AsyncStorage.getItem(profileKey(uid));
  return raw ? JSON.parse(raw) : null;
}

async function saveProfile(uid: string, data: ProfileData): Promise<void> {
  await AsyncStorage.setItem(profileKey(uid), JSON.stringify(data));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const stored = await loadProfile(firebaseUser.uid);
        setProfile(stored);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    const stored = await loadProfile(u.uid);
    setUser(u);
    setProfile(stored);
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
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<ProfileData>) => {
    if (!user) return;
    const updated: ProfileData = { ...(profile ?? { nombre: '', apellido: '', telefono: '', actividadPreferida: '', photoUri: null }), ...data };
    await saveProfile(user.uid, updated);
    setProfile(updated);
    const displayName = `${updated.nombre} ${updated.apellido}`.trim();
    if (displayName) {
      await firebaseUpdateProfile(user, { displayName });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, profile, login, register, logout, resetPassword, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
