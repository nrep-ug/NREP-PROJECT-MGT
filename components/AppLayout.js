'use client';

import { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';

export default function AppLayout({ user, children }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);

      // Auto-collapse on mobile
      if (mobile) {
        setIsCollapsed(true);
        setIsMobileOpen(false);
      } else {
        setIsCollapsed(false);
      }
    };

    // Initial check
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  }, [pathname, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const sidebarWidth = isCollapsed ? '80px' : '260px';

  return (
    <>
      <Sidebar
        user={user}
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        isMobileOpen={isMobileOpen}
        onToggle={toggleSidebar}
      />
      <div
        className="main-content"
        style={{
          marginLeft: isMobile ? '0' : sidebarWidth
        }}
      >
        <Container fluid className="py-3">
          {children}
        </Container>
      </div>
    </>
  );
}
