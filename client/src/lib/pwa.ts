export function registerServiceWorker() {
  // Service workers are a progressive enhancement - gracefully handle failures
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✓ Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          // This is normal in development - service workers require specific conditions
          console.log('Service Worker not registered (requires production build):', error.message);
        });
    });
  }
}

export function checkForPWAInstall() {
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install banner or button
    const installBanner = document.createElement('div');
    installBanner.className = 'install-banner';
    installBanner.innerHTML = `
      <div style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--primary); color: var(--primary-foreground); padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: flex; gap: 12px; align-items: center;">
        <span>Install Workspace for a better experience</span>
        <button id="install-pwa-btn" style="background: white; color: var(--primary); border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: 600;">Install</button>
        <button id="dismiss-pwa-btn" style="background: transparent; color: white; border: none; padding: 6px; cursor: pointer;">✕</button>
      </div>
    `;
    document.body.appendChild(installBanner);

    document.getElementById('install-pwa-btn')?.addEventListener('click', async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      deferredPrompt = null;
      installBanner.remove();
    });

    document.getElementById('dismiss-pwa-btn')?.addEventListener('click', () => {
      installBanner.remove();
    });
  });
}
