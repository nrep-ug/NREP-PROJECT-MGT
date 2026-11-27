'use client';

import Link from 'next/link';
import MetricCard from '@/components/ui/MetricCard';
import styles from './FinanceWorkspace.module.css';

/**
 * A MetricCard that drills into its source (Section 2) — visually lifts on
 * hover/focus with a chevron hint, so it reads as interactive without
 * turning the page into a sea of buttons. Only used where the destination
 * is a real, specific record view; decorative cards stay plain MetricCards.
 */
export default function ClickableMetricCard({ href, ...metricProps }) {
  return (
    <Link href={href} className={styles.clickableCard}>
      <MetricCard {...metricProps} />
      <i className={`bi bi-chevron-right ${styles.clickableCardChevron}`} aria-hidden="true" />
    </Link>
  );
}
