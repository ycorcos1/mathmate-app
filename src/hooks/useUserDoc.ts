import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { ThemeMode } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';

export type ThemePreference = ThemeMode;

export interface UserSettingsDoc {
  theme: ThemePreference;
  voiceMode: boolean;
}

export interface UserStatsDoc {
  sessionsCount: number;
  hintsUsed: number;
  avgSolveSec: number;
}

export interface UserDoc {
  displayName: string;
  email: string;
  createdAt?: unknown;
  lastLoginAt?: unknown;
  stats?: UserStatsDoc;
  settings?: UserSettingsDoc;
}

interface UseUserDocState {
  data: UserDoc | null;
  loading: boolean;
  error: Error | null;
}

const initialState: UseUserDocState = {
  data: null,
  loading: true,
  error: null,
};

export const useUserDoc = () => {
  const { user } = useAuth();
  const [state, setState] = useState<UseUserDocState>(initialState);

  useEffect(() => {
    if (!user) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const userRef = doc(firestore, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ data: null, loading: false, error: null });
          return;
        }

        setState({
          data: snapshot.data() as UserDoc,
          loading: false,
          error: null,
        });
      },
      (error) => {
        console.error('Failed to subscribe to user document', error);
        setState({ data: null, loading: false, error });
      },
    );

    return () => unsubscribe();
  }, [user]);

  return useMemo(
    () => ({
      userDoc: state.data,
      userId: user?.uid ?? null,
      loading: state.loading,
      error: state.error,
    }),
    [state.data, state.error, state.loading, user?.uid],
  );
};
