import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signUp: (email: string, password: string, displayName?: string) => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const deriveDisplayName = (user: User): string => {
  if (user.displayName && user.displayName.trim().length > 0) {
    return user.displayName.trim();
  }

  if (user.email) {
    return user.email.split('@')[0] ?? '';
  }

  return 'MathMate Learner';
};

const ensureUserRecord = async (firebaseUser: User, displayNameOverride?: string | null) => {
  const userRef = doc(firestore, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const email = firebaseUser.email ?? '';
  const overrideDisplayName = displayNameOverride?.trim() ?? '';
  const firebaseDisplayName = firebaseUser.displayName?.trim() ?? '';
  const resolvedDisplayName = overrideDisplayName || firebaseDisplayName;
  const initialDisplayName = resolvedDisplayName || deriveDisplayName(firebaseUser);

  if (!snapshot.exists()) {
    const batch = writeBatch(firestore);
    const timestamp = serverTimestamp();

    batch.set(userRef, {
      displayName: initialDisplayName,
      email,
      createdAt: timestamp,
      lastLoginAt: timestamp,
      stats: {
        sessionsCount: 0,
        hintsUsed: 0,
        avgSolveSec: 0,
      },
      settings: {
        theme: 'system',
        voiceMode: false,
      },
    });

    const progressPlaceholderRef = doc(
      firestore,
      'users',
      firebaseUser.uid,
      'progress',
      'placeholder',
    );

    batch.set(progressPlaceholderRef, {
      initializedAt: timestamp,
      placeholder: true,
    });

    await batch.commit();
    return;
  }

  const data = snapshot.data() as { displayName?: string; email?: string } | undefined;
  const updates: Record<string, unknown> = {
    lastLoginAt: serverTimestamp(),
  };

  if (resolvedDisplayName && data?.displayName !== resolvedDisplayName) {
    updates.displayName = resolvedDisplayName;
  }

  if (email && data?.email !== email) {
    updates.email = email;
  }

  await updateDoc(userRef, updates);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);

        try {
          await ensureUserRecord(firebaseUser);
        } catch (error) {
          console.error('Failed to sync user record', error);
        } finally {
          setUser(firebaseUser);
          setLoading(false);
        }
        return;
      }

      setUser(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserRecord(credential.user);
    return credential;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    const trimmedDisplayName = displayName?.trim() ?? '';

    if (trimmedDisplayName) {
      await updateProfile(credential.user, {
        displayName: trimmedDisplayName,
      });
      await credential.user.reload();
    }

    const refreshedUser = auth.currentUser ?? credential.user;

    await ensureUserRecord(refreshedUser, trimmedDisplayName || null);
    setUser(refreshedUser);

    return credential;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signOutUser, sendResetEmail, refreshUser }),
    [loading, refreshUser, sendResetEmail, signIn, signOutUser, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
