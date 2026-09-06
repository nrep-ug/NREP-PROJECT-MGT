import styles from './WorkspaceUI.module.css';

export default function SectionCard({ title, description, action, children, flush = false, className = '' }) {
  return (
    <section className={`${styles.sectionCard} ${className}`}>
      {(title || description || action) && (
        <div className={styles.sectionHeader}>
          <div>
            {title && <h2 className={styles.sectionTitle}>{title}</h2>}
            {description && <p className={styles.sectionDescription}>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? styles.sectionBodyFlush : styles.sectionBody}>{children}</div>
    </section>
  );
}
