import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authService.me();
      setUser(data.user);
    } catch { /* interceptor handles expired sessions */ }
  }, []);

  useEffect(() => {
    localStorage.removeItem('token'); // key used by the old version
    if (!tokenStore.get()) { setLoading(false); return; }
    authService.me()
      .then(({ data }) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => { tokenStore.set(token); setUser(userData); };
  const logout = () => { tokenStore.clear(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
