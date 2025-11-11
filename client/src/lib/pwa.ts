import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  // Service workers are a progressive enhancement - gracefully handle failures
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      immediate: true,
      onRegistered(registration) {
        console.log('✓ Service Worker registered:', registration?.scope);
      },
      onRegisterError(error) {
        console.error('Service Worker registration error:', error);
      },
      onNeedRefresh() {
        // New service worker available - show update notification
        if (confirm('New version available! Click OK to refresh.')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });
  }
}

export function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.update();
      });
    });
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (isOnline: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installPromptListeners: Array<() => void> = [];

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function checkForPWAInstall() {
  // Check if already available (event might have fired before listener was added)
  if (deferredPrompt) {
    notifyInstallPromptListeners();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('✓ PWA install prompt available');
    notifyInstallPromptListeners();
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('✓ PWA was installed');
    deferredPrompt = null;
    notifyInstallPromptListeners();
  });
}

export function onInstallPromptAvailable(callback: () => void): () => void {
  installPromptListeners.push(callback);
  // Immediately call if already available
  if (deferredPrompt) {
    callback();
  }
  // Return cleanup function
  return () => {
    installPromptListeners = installPromptListeners.filter(cb => cb !== callback);
  };
}

function notifyInstallPromptListeners() {
  installPromptListeners.forEach(callback => callback());
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    return outcome === 'accepted';
  } catch (error) {
    console.error('Error showing install prompt:', error);
    return false;
  }
}

export function canInstallPWA(): boolean {
  return deferredPrompt !== null;
}

export function isPWAInstalled(): boolean {
  // Check if running as standalone (installed PWA)
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

// Badge API functions
export async function setAppBadge(count: number | null): Promise<void> {
  try {
    // Try Badge API first (works in PWA on Android/iOS)
    if ('setAppBadge' in navigator) {
      if (count === null || count === 0) {
        await (navigator as any).clearAppBadge();
        console.log(`✓ Badge cleared`);
      } else {
        await (navigator as any).setAppBadge(count);
        console.log(`✓ Badge updated to: ${count}`);
      }
      return;
    }
    
    // Fallback: send message to service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'UPDATE_BADGE',
            count: count || 0,
          });
          console.log(`✓ Badge update message sent to service worker: ${count || 0}`);
        }
      } catch (error) {
        console.error('Error sending badge update to service worker:', error);
      }
    } else {
      console.warn('Badge API and Service Worker not available');
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0);
}

export function isBadgeSupported(): boolean {
  return 'setAppBadge' in navigator || 'serviceWorker' in navigator;
}
