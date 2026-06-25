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
import { meshAlert } from '@/lib/meshAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { syncUsuario, obtenerMiPerfil, type UsuarioPerfilResponse } from '@/lib/usuariosApi';
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

// Mezcla en el perfil local los campos que vienen de la BD (teléfono y actividad
// preferida) conservando los que solo viven en el dispositivo (apellido, foto).
function mergeBackendProfile(
  base: ProfileData | null,
  backend: UsuarioPerfilResponse
): ProfileData {
  const apellido = backend.apellido ?? base?.apellido ?? '';
  // `backend.nombre` guarda el nombre completo. Si no hay perfil local (ej. login
  // en otro dispositivo) derivamos el nombre de pila quitando el apellido.
  let nombre = base?.nombre ?? '';
  if (!nombre) {
    nombre =
      apellido && backend.nombre.endsWith(apellido)
        ? backend.nombre.slice(0, backend.nombre.length - apellido.length).trim()
        : backend.nombre;
  }
  return {
    nombre,
    apellido,
    photoUri: base?.photoUri ?? null,
    telefono: backend.telefono ?? '',
    actividadPreferida: backend.actividad_preferida ?? '',
  };
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
    meshAlert(
      'No se pudo conectar con el servidor',
      `No pudimos sincronizar tu usuario con la base de datos.\n\n` +
        `Backend: ${API_BASE_URL}\n\n` +
        `Verificá que el backend esté corriendo (npm run dev) y que el celular esté en la misma Wi‑Fi que la PC.\n\n` +
        `Detalle: ${detail}`,
      [{ text: 'Entendido' }]
    );
  }, []);

  // Resuelve la fila del usuario en el backend (lectura o escritura según el caller),
  // guarda el id mapeado e hidrata el perfil local con los campos que viven en la BD.
  const resolverUsuarioBackend = useCallback(
    async (
      firebaseUser: User,
      baseProfile: ProfileData | null,
      obtener: () => Promise<UsuarioPerfilResponse>
    ) => {
      setBackendSyncing(true);
      try {
        const fila = await obtener();
        await AsyncStorage.setItem(backendUserIdKey, fila.id);
        setBackendUserId(fila.id);
        syncAlertShown.current = false;
        // La BD es la fuente de verdad de teléfono y actividad preferida.
        const hidratado = mergeBackendProfile(baseProfile, fila);
        await saveProfile(firebaseUser.uid, hidratado);
        setProfile(hidratado);
        return true;
      } catch (e) {
        const cached = await AsyncStorage.getItem(backendUserIdKey);
        if (cached) setBackendUserId(cached);
        notifySyncFailure(e);
        return false;
      } finally {
        setBackendSyncing(false);
      }
    },
    [notifySyncFailure]
  );

  // Carga el perfil desde la BD (load / login): NO pisa la BD con datos locales.
  const cargarUsuarioBackend = useCallback(
    (firebaseUser: User, storedProfile: ProfileData | null) => {
      if (!firebaseUser.email) return Promise.resolve(false);
      return resolverUsuarioBackend(firebaseUser, storedProfile, () => obtenerMiPerfil());
    },
    [resolverUsuarioBackend]
  );

  // Persiste el perfil en la BD (registro / edición de perfil).
  const guardarUsuarioBackend = useCallback(
    (firebaseUser: User, perfil: ProfileData) => {
      const email = firebaseUser.email;
      if (!email) return Promise.resolve(false);
      return resolverUsuarioBackend(firebaseUser, perfil, () =>
        syncUsuario({
          email,
          nombre: displayNombre(perfil, firebaseUser),
          apellido: perfil.apellido || null,
          telefono: perfil.telefono ?? null,
          actividadPreferida: perfil.actividadPreferida || null,
        })
      );
    },
    [resolverUsuarioBackend]
  );
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
          await cargarUsuarioBackend(firebaseUser, stored);
        } else {
          setProfile(null);
          setBackendUserId(null);
          syncAlertShown.current = false;
          await AsyncStorage.removeItem(backendUserIdKey);
        }
      })();
    });
    return unsubscribe;
  }, [cargarUsuarioBackend]);

  const login = async (email: string, password: string) => {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    const stored = await loadProfile(u.uid);
    setUser(u);
    setProfile(stored);
    await cargarUsuarioBackend(u, stored);
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
    await guardarUsuarioBackend(newUser, newProfile);
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
    await guardarUsuarioBackend(user, updated);
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
