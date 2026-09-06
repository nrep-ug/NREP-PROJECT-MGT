export function formatCurrency(amount, currency) {
  const code = currency || 'USD';
  const digits = ['UGX', 'KES', 'TZS'].includes(code) ? 0 : 2;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'code',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount || 0));
}

export function formatPercent(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export function formatFinanceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
