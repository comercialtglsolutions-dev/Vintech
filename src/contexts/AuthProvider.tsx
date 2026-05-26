import React, { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext, Profile } from './AuthContext';

const PROFILE_CACHE_KEY = 'vintech-profile-cache';
const SESSION_FLAG_KEY  = 'vintech-session-active';
const LOGOUT_FLAG_KEY   = 'vintech-explicit-logout';

export const readCachedProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeCachedProfile = (profile: Profile | null) => {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
      sessionStorage.removeItem(LOGOUT_FLAG_KEY);
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession]   = useState<Session | null>(null);
  const [user, setUser]         = useState<User | null>(null);
  const [profile, setProfile]   = useState<Profile | null>(readCachedProfile);
  const [loading, setLoading]   = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, winery:wineries(name, slug)`)
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      // Não engolir silenciosamente: um profile que falha em carregar deixa
      // winery_id nulo e trava toda a UI em loading. Logamos com detalhe.
      console.error('[Auth] Falha ao carregar profile:', (err as any)?.message || err);
      return null;
    }
  };

  // Recupera contas cujo profile ficou sem winery_id (trigger de signup falho).
  // Sem isso o trial não aparece e as páginas ficam em loading infinito.
  const ensureWineryLinked = async (
    userId: string,
    current: Profile | null,
  ): Promise<Profile | null> => {
    if (!current || current.winery_id) return current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return current;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/ensure-winery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        console.error('[Auth] ensure-winery falhou:', res.status);
        return current;
      }
      // Recarrega o profile já com winery_id + join da vinícola.
      const linked = await fetchProfile(userId);
      return linked || current;
    } catch (err) {
      console.error('[Auth] ensureWineryLinked error:', err);
      return current;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const data = await fetchProfile(user.id);
    if (data) { setProfile(data); writeCachedProfile(data); }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        let fresh = await fetchProfile(session.user.id);
        if (fresh && !fresh.winery_id) fresh = await ensureWineryLinked(session.user.id, fresh);
        if (mounted && fresh) { setProfile(fresh); writeCachedProfile(fresh); }
      } else {
        // Sem sessão real: limpa apenas se foi logout explícito
        if (sessionStorage.getItem(LOGOUT_FLAG_KEY) === '1') {
          setProfile(null);
          writeCachedProfile(null);
          sessionStorage.removeItem(SESSION_FLAG_KEY);
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          let fresh = await fetchProfile(session.user.id);
          if (fresh && !fresh.winery_id) fresh = await ensureWineryLinked(session.user.id, fresh);
          if (mounted && fresh) { setProfile(fresh); writeCachedProfile(fresh); }
        }
        if (mounted) setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        writeCachedProfile(null);
        sessionStorage.removeItem(SESSION_FLAG_KEY);
        if (mounted) setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    // 1. Marca logout explícito
    sessionStorage.setItem(LOGOUT_FLAG_KEY, '1');
    sessionStorage.removeItem(SESSION_FLAG_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
    
    // 2. Atualização otimista (instantânea) da interface
    setSession(null);
    setUser(null);
    setProfile(null);

    // 3. Desloga no backend silenciosamente em background (sem await)
    supabase.auth.signOut().catch(console.error);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, signInWithGoogle, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
