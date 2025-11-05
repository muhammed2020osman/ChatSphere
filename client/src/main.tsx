import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker, checkForPWAInstall } from "./lib/pwa";
import { subscribeToPushNotifications, getPushSubscription, convertSubscriptionToJSON } from "./lib/push-notifications";

// Register PWA service worker
registerServiceWorker();

// Check for PWA install prompt
checkForPWAInstall();

// Function to initialize push notifications after user is authenticated
async function initializePushNotifications() {
  try {
    // Get VAPID public key from server
    const response = await fetch('/api/push/vapid-public-key');
    if (!response.ok) {
      console.warn('VAPID public key not available');
      return;
    }

    const { publicKey } = await response.json();
    
    // Check if already subscribed
    const existingSubscription = await getPushSubscription();
    if (existingSubscription) {
      // Send existing subscription to server to ensure it's saved
      const subData = convertSubscriptionToJSON(existingSubscription);
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ subscription: subData }),
      });
      console.log('Push notification subscription verified');
      return;
    }

    // Subscribe to push notifications
    const subscription = await subscribeToPushNotifications(publicKey);
    if (subscription) {
      // Send subscription to server
      const subData = convertSubscriptionToJSON(subscription);
      const subResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ subscription: subData }),
      });

      if (subResponse.ok) {
        console.log('Push notification subscription saved');
      } else {
        console.error('Failed to save push notification subscription');
      }
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

// Initialize push notifications after a delay to ensure service worker is ready
// This will be called when user is authenticated (checked in main.tsx)
setTimeout(() => {
  // Check if user is authenticated (simple check - you may want to enhance this)
  const isAuthenticated = document.cookie.includes('session') || localStorage.getItem('auth_token');
  if (isAuthenticated) {
    initializePushNotifications();
  }
}, 3000);

createRoot(document.getElementById("root")!).render(<App />);
