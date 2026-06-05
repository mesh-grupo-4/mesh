/* ============================================================
   Mesh — shared UI primitives
   ============================================================ */
const { useState: useStateUI } = React;

function Avatar({ person, name, size = 'md', ring = false }) {
  const nm = name || (person ? fullName(person) : '?');
  const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : 'avatar';
  return (
    <div className={cls + (ring ? ' avatar-ring' : '')}
      style={{ background: avColor(nm) }}>{initials(nm)}</div>
  );
}

function AvatarStack({ ids, max = 4, size = 'sm' }) {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <div className="avatar-stack">
      {shown.map(id => <Avatar key={id} person={byId(id)} size={size} />)}
      {extra > 0 && (
        <div className={'avatar ' + (size === 'sm' ? 'avatar-sm' : '')}
          style={{ background: 'var(--surface-3)', color: 'var(--text-dim)', boxShadow: '0 0 0 2.5px var(--surface)' }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function TopBar({ title, onBack, right, bordered = true, big = false, sub }) {
  return (
    <div className={'topbar' + (bordered ? ' bordered' : '')}>
      {onBack && (
        <button className="iconbtn" onClick={onBack} aria-label="Atrás"><Icon name="back" size={22} /></button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {sub && <div className="small dim" style={{ marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const TABS = [
  { key: 'inicio', label: 'Inicio', icon: 'home' },
  { key: 'grupos', label: 'Grupos', icon: 'users' },
  { key: 'viajes', label: 'Viajes', icon: 'map' },
  { key: 'perfil', label: 'Perfil', icon: 'user' },
];

function TabBar({ active, onChange }) {
  return (
    <div className="tabbar">
      {TABS.map(t => (
        <button key={t.key} className={'tab' + (active === t.key ? ' active' : '')} onClick={() => onChange(t.key)}>
          <span className="tab-ico"><Icon name={t.icon} size={23} stroke={active === t.key ? 2.4 : 2} /></span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function Btn({ variant = 'primary', size, block, icon, iconRight, children, onClick, disabled, style }) {
  const cls = ['btn', `btn-${variant}`, block && 'btn-block', size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm']
    .filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={style}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

function Chip({ active, icon, children, onClick }) {
  return (
    <button className={'chip' + (active ? ' active' : '')} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

function Badge({ tone = 'mute', children, pulse }) {
  return (
    <span className={'badge badge-' + tone}>
      {pulse && <span className="dot dot-pulse" />}
      {children}
    </span>
  );
}

function Field({ label, leading, ...props }) {
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      <div className={leading ? 'input-icon' : ''}>
        {leading && <span className="leading"><Icon name={leading} size={19} /></span>}
        <input className="input" {...props} />
      </div>
    </div>
  );
}

function Eyebrow({ children, style }) { return <div className="eyebrow" style={style}>{children}</div>; }

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="section-h">
      <h3 className="h3">{title}</h3>
      {action && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px' }} onClick={onAction}>{action}</button>}
    </div>
  );
}

// Activity glyph in a tinted rounded square
function ActivityTile({ activity, size = 46, accent }) {
  const col = accent || 'var(--accent)';
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
      background: 'color-mix(in srgb, ' + col + ' 16%, transparent)', color: col,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={ACTIVITY_ICON[activity] || 'route'} size={size * 0.52} stroke={2} />
    </div>
  );
}

// A faux QR built from a deterministic grid (no external dep)
function FauxQR({ seed = 'mesh', size = 180, fg = '#16110e' }) {
  const n = 21;
  let h = 7; const rnd = () => { h = (h * 1103515245 + 12345 + seed.length) & 0x7fffffff; return (h >> 8) & 1; };
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    cells.push({ x, y, on: finder ? false : !!rnd() });
  }
  const c = size / n;
  const eye = (ox, oy) => (
    <g key={ox + '-' + oy}>
      <rect x={ox * c} y={oy * c} width={c * 7} height={c * 7} rx={c * 1.4} fill={fg} />
      <rect x={(ox + 1) * c} y={(oy + 1) * c} width={c * 5} height={c * 5} rx={c} fill="#fff" />
      <rect x={(ox + 2) * c} y={(oy + 2) * c} width={c * 3} height={c * 3} rx={c * 0.7} fill={fg} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells.filter(d => d.on).map((d, i) => (
        <rect key={i} x={d.x * c + c * 0.1} y={d.y * c + c * 0.1} width={c * 0.8} height={c * 0.8} rx={c * 0.25} fill={fg} />
      ))}
      {eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}
    </svg>
  );
}

Object.assign(window, {
  Avatar, AvatarStack, TopBar, TabBar, TABS, Btn, Chip, Badge, Field,
  Eyebrow, SectionHeader, ActivityTile, FauxQR,
});
