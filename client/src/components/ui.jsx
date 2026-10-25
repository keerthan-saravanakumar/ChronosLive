import { cloneElement, useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, initials } from '../utils/format';
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 5h3m4 0h3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-12 0h0m4 12h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    back: <path d="M20 12H4m6-6-6 6 6 6"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <path d="m6 6 12 12M6 18 18 6"/>,
    location: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    logout: <><path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h12"/></>,
    shield: <><path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Z"/><path d="m8 12 3 3 5-6"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    spark: <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>,
    filter: <path d="M4 5h16l-6 7v7l-4 2v-9L4 5Z"/>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.calendar}</svg>;
}
export const Button = ({ children, variant = 'primary', className = '', loading, ...props }) => <button {...props} className={'btn btn-' + variant + ' ' + className} aria-busy={loading || undefined} disabled={loading || props.disabled}>{loading ? <span className="spinner" aria-hidden="true"/> : null}{children}</button>;
export const Badge = ({ children, tone = 'green' }) => <span className={'badge badge-' + tone}>{children}</span>;
export const Avatar = ({ user, size = '' }) => <span className={'avatar ' + size}>{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user?.name)}</span>;
export function Field({ label, children, hint, ...props }) {
  const id = useId();
  return <label className="field" htmlFor={id}><span>{label}</span>{children ? cloneElement(children, { id }) : <input id={id} {...props}/>} {hint && <small>{hint}</small>}</label>;
}
export function EmptyState({ title = 'A little room for something new', description, to, action = 'Explore services', icon = 'calendar' }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{to && <Link className="btn btn-primary" to={to}>{action}<Icon name="arrow" size={16}/></Link>}</div>;
}
export function ErrorState({ error, retry }) {
  return <div className="error-state" role="alert"><Icon name="shield"/><div><strong>We could not load this just yet.</strong><p>{errorMessage(error)}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div></div>;
}
export function Skeletons({ count = 3 }) { return <div className="cards-grid" aria-label="Loading" role="status">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton cover"/><div className="skeleton line"/><div className="skeleton line short"/></div>)}</div>; }
export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><Icon name="back" size={16}/>Previous</Button><span>Page {meta.page} of {meta.pages}</span><Button variant="secondary" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next<Icon name="arrow" size={16}/></Button></nav>;
}
export function ConfirmDialog({ open, title, children, onClose, onConfirm, busy, confirmLabel = 'Confirm', danger = false }) {
  const dialog = useRef(), label = useId();
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} className="dialog" aria-labelledby={label} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><div className="dialog-body"><h2 id={label}>{title}</h2><div className="dialog-copy">{children}</div><div className="dialog-actions"><Button variant="secondary" autoFocus onClick={onClose} disabled={busy}>Keep it</Button><Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button></div></div></dialog>;
}
