'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppLayout.module.css';

const CLIENT_NAV = [
  { href: '/client/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { href: '/client/projects', label: 'Projects', icon: 'bi-folder' },
  { href: '/client/profile', label: 'My Profile', icon: 'bi-person-circle' },
];

const STAFF_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { href: '/projects', label: 'Projects', icon: 'bi-folder' },
  { href: '/clients', label: 'Clients', icon: 'bi-people' },
  { href: '/timesheets', label: 'Timesheets', icon: 'bi-clock-history' },
  { href: '/timesheets/reports', label: 'Timesheet Analytics', icon: 'bi-bar-chart-line' },
  { href: '/finance', label: 'Finance', icon: 'bi-cash-coin', financeViewOnly: true },
  { href: '/profile', label: 'My Profile', icon: 'bi-person-circle' },
  { href: '/admin', label: 'Admin', icon: 'bi-gear', adminOnly: true },
];

function userRoleLabel(user) {
  if (user?.isAdmin) return 'Administrator';
  if (user?.financeRole === 'reviewer') return 'Finance Reviewer';
  if (user?.financeRole === 'officer') return 'Finance Officer';
  if (user?.financeRole === 'budget_approver') return 'Budget Approver';
  if (user?.financeRole === 'administrator') return 'Finance Administrator';
  if (user?.hasProjectFinanceAccess) return 'Project Head';
  if (user?.isManager) return 'Management';
  if (user?.isSupervisor) return 'Supervisor';
  if (user?.isClient) return 'Client';
  return 'Staff';
}
export default function Sidebar({ user, isCollapsed, isMobile, isMobileOpen, onToggle }) {
  const pathname = usePathname();
  const navItems = user?.isClient ? CLIENT_NAV : STAFF_NAV;
  const showLabels = !isCollapsed || isMobileOpen;
  const sidebarWidth = isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';
  const name = `${user?.firstName || user?.profile?.firstName || ''} ${user?.lastName || user?.profile?.lastName || ''}`.trim() || user?.email || 'NREP user';
  const initial = name.charAt(0) || 'N';
  const canSeeFinance = user?.isFinance || user?.isManager || user?.isAdmin || user?.hasProjectFinanceAccess;

  return (
    <>
      {isMobile && isMobileOpen && <button type="button" className={styles.sidebarOverlay} onClick={onToggle} aria-label="Close navigation" />}
      <button
        type="button"
        className={`${styles.sidebarToggle} ${isMobileOpen ? styles.sidebarToggleMobileOpen : ''}`}
        style={{ '--sidebar-current-width': sidebarWidth }}
        onClick={onToggle}
        aria-label={isMobileOpen || (!isMobile && !isCollapsed) ? 'Collapse navigation' : 'Open navigation'}
        aria-expanded={isMobile ? isMobileOpen : !isCollapsed}
      >
        <i className={`bi ${isMobileOpen ? 'bi-x-lg' : isCollapsed ? 'bi-list' : 'bi-chevron-left'}`} />
      </button>

      <aside
        className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarMobileOpen : ''}`}
        style={{ '--sidebar-current-width': sidebarWidth }}
        aria-label="Primary navigation"
      >
        <div className={styles.sidebarHeader}>
          <div className={`${styles.sidebarBrand} ${!showLabels ? styles.sidebarBrandCollapsed : ''}`}>
            <span className={styles.brandMark}><Image className={styles.brandImage} src="/images/logo.png" alt="NREP" width={40} height={40} priority /></span>
            {showLabels && <span className={styles.brandCopy}><span className={styles.brandName}>NREP</span><span className={styles.brandProduct}>Project Management System</span></span>}
          </div>
          {user?.isClient && showLabels && <span className={styles.portalBadge}><i className="bi bi-person-badge" />Client portal</span>}
        </div>

        {showLabels ? (
          <div className={styles.userPanel}>
            <span className={styles.userAvatar}>{initial}</span>
            <span className={styles.userDetails}><span className={styles.userName}>{name}</span><span className={styles.userRole}><i className="bi bi-shield-check" />{userRoleLabel(user)}</span></span>
          </div>
        ) : (
          <div className={styles.collapsedUser}><span className={`${styles.userAvatar} ${styles.userAvatarCollapsed}`} title={name}>{initial}</span></div>
        )}

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            if (item.adminOnly && !user?.isAdmin) return null;
            if (item.financeViewOnly && !canSeeFinance) return null;
            if (item.approverOnly && !user?.isSupervisor && !user?.isAdmin) return null;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ''}`}
                title={showLabels ? undefined : item.label}
                aria-current={active ? 'page' : undefined}
              >
                <i className={`${styles.sidebarLinkIcon} bi ${item.icon}`} />
                {showLabels && <span className={styles.sidebarLinkLabel}>{item.label}</span>}
              </Link>
            );
          })}
          <div className={styles.sidebarDivider} />
          <Link href="/logout" className={`${styles.sidebarLink} ${styles.logoutLink}`} title={showLabels ? undefined : 'Log out'}>
            <i className={`${styles.sidebarLinkIcon} bi bi-box-arrow-right`} />
            {showLabels && <span className={styles.sidebarLinkLabel}>Log out</span>}
          </Link>
        </nav>
        {showLabels && <footer className={styles.sidebarFooter}>© {new Date().getFullYear()} NREP</footer>}
      </aside>
    </>
  );
}
