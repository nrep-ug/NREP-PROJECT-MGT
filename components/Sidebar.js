'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Nav, Badge } from 'react-bootstrap';

export default function Sidebar({ user, isCollapsed, isMobile, isMobileOpen, onToggle }) {
  const pathname = usePathname();

  // Define navigation items based on user role
  const clientNavItems = [
    { href: '/client/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { href: '/client/projects', label: 'Projects', icon: 'bi-folder' },
    { href: '/client/profile', label: 'My Profile', icon: 'bi-person-circle' },
  ];

  const staffNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { href: '/projects', label: 'Projects', icon: 'bi-folder' },
    { href: '/clients', label: 'Clients', icon: 'bi-people' },
    { href: '/timesheets', label: 'Timesheets', icon: 'bi-clock-history' },
    { href: '/profile', label: 'My Profile', icon: 'bi-person-circle' },
    { href: '/admin', label: 'Admin', icon: 'bi-gear', adminOnly: true },
  ];

  // Select appropriate navigation items based on user role
  const navItems = user?.isClient ? clientNavItems : staffNavItems;

  const sidebarWidth = isCollapsed ? '80px' : '260px';
  const showLabels = !isCollapsed || isMobileOpen;

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
        />
      )}

      {/* Toggle Button */}
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label="Toggle Sidebar"
        style={{
          backgroundColor: 'white',
          border: '2px solid #e2e8f0',
          color: '#054653',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1050
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#054653';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.borderColor = '#054653';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.color = '#054653';
          e.currentTarget.style.borderColor = '#e2e8f0';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <i className={`bi ${isCollapsed || !isMobileOpen ? 'bi-list' : 'bi-x'}`} style={{ fontSize: '1.25rem' }}></i>
      </button>

      {/* Sidebar */}
      <div
        className={`modern-sidebar ${isMobile && isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: isMobile ? '260px' : sidebarWidth,
          background: 'linear-gradient(180deg, #054653 0%, #043840 100%)',
          boxShadow: '4px 0 20px rgba(5, 70, 83, 0.15)'
        }}
      >
        {/* Logo/Brand */}
        <div className="sidebar-header" style={{ padding: '1.5rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div className="sidebar-brand" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'flex-start' : 'center',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: '700'
          }}>
            {showLabels ? (
              <>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)'
                  }}
                >
                  <i className="bi bi-lightning-charge-fill" style={{ fontSize: '1.25rem', color: 'white' }}></i>
                </div>
                <span className="brand-text" style={{ letterSpacing: '-0.5px', color: 'white' }}>NREP PMS</span>
              </>
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)'
                }}
              >
                <i className="bi bi-lightning-charge-fill" style={{ fontSize: '1.25rem', color: 'white' }}></i>
              </div>
            )}
          </div>
          {user?.isClient && showLabels && (
            <Badge
              bg=""
              className="mt-2 w-100"
              style={{
                backgroundColor: 'rgba(20, 184, 166, 0.2)',
                color: '#14B8A6',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                padding: '0.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.75rem'
              }}
            >
              <i className="bi bi-person-circle me-1"></i>
              Client Portal
            </Badge>
          )}
        </div>

        {/* User Info */}
        {user && showLabels && (
          <div style={{
            padding: '1.25rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '1.25rem',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
              textTransform: 'uppercase'
            }}>
              {user.profile?.firstName?.[0] || user.email?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '700',
                fontSize: '0.95rem',
                color: 'white',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '0.25rem'
              }}>
                {user.profile?.firstName || user.name || 'User'}
                {user.profile?.lastName && ` ${user.profile.lastName}`}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: '500'
              }}>
                {user.isAdmin ? (
                  <><i className="bi bi-shield-check me-1"></i>Administrator</>
                ) : user.isClient ? (
                  <><i className="bi bi-person me-1"></i>Client</>
                ) : (
                  <><i className="bi bi-briefcase me-1"></i>Staff</>
                )}
              </div>
            </div>
          </div>
        )}

        {!showLabels && user && (
          <div style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '1.1rem',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
              textTransform: 'uppercase'
            }}>
              {user.profile?.firstName?.[0] || user.email?.[0] || 'U'}
            </div>
          </div>
        )}

        {/* Navigation */}
        <Nav className="sidebar-nav flex-column flex-nowrap" style={{
          flex: 1,
          padding: '1rem 0.75rem',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {navItems.map((item) => {
            // Only show admin menu to users with admin role
            if (item.adminOnly && !user?.isAdmin) {
              return null;
            }

            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Nav.Link
                key={item.href}
                as={Link}
                href={item.href}
                className="sidebar-link"
                title={!showLabels ? item.label : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.875rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '10px',
                  color: isActive ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  backgroundColor: isActive ? 'rgba(20, 184, 166, 0.2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '0.95rem',
                  border: isActive ? '1px solid rgba(20, 184, 166, 0.3)' : '1px solid transparent',
                  justifyContent: showLabels ? 'flex-start' : 'center'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <i
                  className={`${item.icon}`}
                  style={{
                    fontSize: '1.25rem',
                    minWidth: '1.25rem',
                    color: isActive ? '#14B8A6' : 'inherit'
                  }}
                ></i>
                {showLabels && (
                  <span style={{ marginLeft: '0.875rem', whiteSpace: 'nowrap' }}>{item.label}</span>
                )}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '4px',
                    height: '60%',
                    backgroundColor: '#14B8A6',
                    borderRadius: '0 4px 4px 0',
                    boxShadow: '0 0 12px rgba(20, 184, 166, 0.5)'
                  }} />
                )}
              </Nav.Link>
            );
          })}

          <div style={{
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            margin: '0.75rem 0.5rem'
          }}></div>

          {/* Logout */}
          <Nav.Link
            as={Link}
            href="/logout"
            className="sidebar-link logout-link"
            title={!showLabels ? 'Logout' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.875rem 1rem',
              marginBottom: '0.5rem',
              borderRadius: '10px',
              color: 'rgba(255, 255, 255, 0.7)',
              backgroundColor: 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              fontSize: '0.95rem',
              justifyContent: showLabels ? 'flex-start' : 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.15)';
              e.currentTarget.style.color = '#ff6b6b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: '1.25rem', minWidth: '1.25rem' }}></i>
            {showLabels && <span style={{ marginLeft: '0.875rem', whiteSpace: 'nowrap' }}>Logout</span>}
          </Nav.Link>
        </Nav>

        {/* Footer */}
        {showLabels && (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.75rem'
          }}>
            <small>© {currentYear} NREP</small>
          </div>
        )}
      </div>
    </>
  );
}
