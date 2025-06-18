
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  apartment_number: number | null;
  theme_preference: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  isLoading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>;
}

// Create a context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component to wrap the application
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Clean up auth state to prevent authentication limbo states
  const cleanupAuthState = () => {
    try {
      // Remove all Supabase auth keys from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.log('Error cleaning localStorage:', error);
    }
    
    try {
      // Remove from sessionStorage if available
      if (typeof sessionStorage !== 'undefined') {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.log('Error cleaning sessionStorage:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch to prevent potential deadlocks
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (profileData) {
                setProfile(profileData);
              } else if (error) {
                console.error('Error fetching profile:', error);
              }
            } catch (error) {
              console.error('Error in profile fetch:', error);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Clean up existing auth state first
    cleanupAuthState();
    
    try {
      // Try to sign out first to ensure clean state
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.log('Sign out before login failed (expected)', err);
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        setIsLoading(false);
        return { error: error.message };
      }

      console.log('Login successful:', data);
      return {};
    } catch (error) {
      console.error('Unexpected login error:', error);
      setIsLoading(false);
      return { error: 'An unexpected error occurred' };
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    // Clean up existing auth state first
    cleanupAuthState();
    
    try {
      // Try to sign out first to ensure clean state
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.log('Sign out before registration failed (expected)', err);
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        console.error('Registration error:', error);
        setIsLoading(false);
        return { error: error.message };
      }

      // Send verification email
      if (data.user && !data.user.email_confirmed_at) {
        try {
          await supabase.functions.invoke('send-verification-email', {
            body: { 
              email: data.user.email,
              userId: data.user.id 
            }
          });
          console.log('Verification email sent');
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't fail registration if email sending fails
        }
      }

      console.log('Registration successful:', data);
      setIsLoading(false);
      return {};
    } catch (error) {
      console.error('Unexpected registration error:', error);
      setIsLoading(false);
      return { error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      
      // Don't force page reload - let the app handle state gracefully
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        return { error: error.message };
      }

      // Update local profile state
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return {};
    } catch (error) {
      console.error('Unexpected profile update error:', error);
      return { error: 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      login,
      logout,
      register,
      isLoading,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
