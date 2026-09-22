import { create } from 'zustand';
import { User } from '../types/index.js';
import { api } from '../api/axios.js';
import { queryClient } from '../api/queryClient.js';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('eventra_token'),
  isAuthenticated: !!localStorage.getItem('eventra_token'),
  isLoading: true,

  setAuth: (user, token) => {
    queryClient.clear();
    localStorage.setItem('eventra_token', token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    queryClient.clear();
    void api.post('/auth/logout').catch(() => undefined);
    localStorage.removeItem('eventra_token');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('eventra_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.data?.user) {
        set({ user: res.data.data.user, isAuthenticated: true, isLoading: false });
      } else {
        localStorage.removeItem('eventra_token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      localStorage.removeItem('eventra_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

window.addEventListener('eventra:unauthorized', () => {
  queryClient.clear();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
});
