import React, { useState, useEffect } from 'react';
import { OperatorLayout } from './modes/operator/OperatorLayout';
import { KioskContainer } from './modes/kiosk/KioskContainer';

export function Router() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (
        target &&
        target.getAttribute('href')?.startsWith('/') &&
        !target.getAttribute('target') &&
        !target.hasAttribute('download') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        const href = target.getAttribute('href')!;
        window.history.pushState(null, '', href);
        setCurrentPath(href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  // Match /kiosk/:lane pattern
  const kioskMatch = currentPath.match(/^\/kiosk\/(\d+)/);

  if (kioskMatch) {
    const laneId = parseInt(kioskMatch[1], 10) || 1;
    return <KioskContainer laneId={laneId} />;
  }

  // Default to Operator dashboard for /operator or root /
  return <OperatorLayout />;
}
