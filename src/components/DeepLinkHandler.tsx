
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Extend Window interface to include Capacitor
declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => string;
      isNativePlatform: () => boolean;
    };
  }
}

const DeepLinkHandler = () => {
  useEffect(() => {
    const handleAppUrlOpen = async (data: { url: string }) => {
      console.log('App opened with URL:', data.url);
      
      // Check if this is an auth confirmation link
      if (data.url.includes('auth/confirm')) {
        try {
          // Extract the tokens from the URL
          const url = new URL(data.url.replace('app.lovable.39d5fa31b19c4825a5e8cd8069564bba://', 'https://dummy.com/'));
          const access_token = url.searchParams.get('access_token');
          const refresh_token = url.searchParams.get('refresh_token');
          
          if (access_token && refresh_token) {
            // Set the session with the tokens
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });
            
            if (error) {
              console.error('Error setting session:', error);
            } else {
              console.log('Session set successfully from deep link');
            }
          }
        } catch (error) {
          console.error('Error handling deep link:', error);
        }
      }
    };

    // Only set up deep link handling in Capacitor environment
    const setupDeepLinkHandling = async () => {
      try {
        // Check if we're in a Capacitor environment using a more robust method
        const isCapacitor = typeof window !== 'undefined' && 
                           window.Capacitor && 
                           typeof window.Capacitor.getPlatform === 'function';
        
        if (isCapacitor) {
          // Dynamically import Capacitor App plugin
          const { App } = await import('@capacitor/app');
          
          // Listen for app URL open events
          App.addListener('appUrlOpen', handleAppUrlOpen);

          return () => {
            App.removeAllListeners();
          };
        }
        
        return () => {};
      } catch (error) {
        // Capacitor not available (web environment)
        console.log('Capacitor App plugin not available - running in web mode');
        return () => {};
      }
    };

    let cleanup: (() => void) | undefined;
    
    setupDeepLinkHandling().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return null;
};

export default DeepLinkHandler;
