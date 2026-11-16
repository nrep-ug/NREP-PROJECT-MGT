'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from 'react-bootstrap';
import { getCurrentUser, isFieldOnlyAccount, logout } from '@/lib/auth';
import styles from '@/app/field/field.module.css';

/**
 * Page frame for every champions-portal screen: checks the visitor is a
 * signed-in champion, shows a header with a back button (installed web apps
 * have no browser back button on iPhone) and keeps the layout phone-first.
 */
export default function FieldShell({ title, back = '/field', children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) router.replace('/login');
      else if (!isFieldOnlyAccount(user)) router.replace('/dashboard');
      else setReady(true);
    });
  }, [router]);

  const signOut = async () => {
    try { await logout(); } finally { router.replace('/login'); }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        {back ? (
          <Link href={back} className={styles.backLink} aria-label="Back"><i className="bi bi-chevron-left" aria-hidden="true" /> Back</Link>
        ) : (
          <span className={styles.brand}><i className="bi bi-fire" aria-hidden="true" /> Clean Cooking Champions</span>
        )}
        {title && back && <span className={styles.topTitle}>{title}</span>}
        {!back ? (
          <button type="button" className={styles.linkButton} onClick={signOut}><i className="bi bi-box-arrow-right" aria-hidden="true" /> Log out</button>
        ) : <span className={styles.topSpacer} />}
      </header>
      {ready ? children : <div className={styles.center}><Spinner animation="border" /></div>}
    </main>
  );
}
