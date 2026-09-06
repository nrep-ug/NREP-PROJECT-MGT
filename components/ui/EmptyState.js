import styles from './WorkspaceUI.module.css';

export default function EmptyState({ icon = 'bi-inbox', title, text, action }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <span className={styles.emptyIcon}><i className={`bi ${icon}`} /></span>
        <h3 className={styles.emptyTitle}>{title}</h3>
        {text && <p className={styles.emptyText}>{text}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

