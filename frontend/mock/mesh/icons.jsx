/* ============================================================
   Mesh — icons + brand mark
   Simple stroked line icons (currentColor). Exported to window.
   ============================================================ */

function Icon({ name, size = 22, stroke = 2, color = 'currentColor', fill = 'none', style }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill,
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style,
  };
  switch (name) {
    case 'home':
      return <svg {...p}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>;
    case 'users':
      return <svg {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.2A3 3 0 0 1 16 11"/><path d="M17 14c2.4.4 4 2.3 4 5"/></svg>;
    case 'map':
      return <svg {...p}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/></svg>;
    case 'user':
      return <svg {...p}><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/></svg>;
    case 'plus':
      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'back':
      return <svg {...p}><path d="M15 5l-7 7 7 7"/></svg>;
    case 'chevron':
      return <svg {...p}><path d="M9 5l7 7-7 7"/></svg>;
    case 'chevron-down':
      return <svg {...p}><path d="M5 9l7 7 7-7"/></svg>;
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'qr':
      return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21h.01"/></svg>;
    case 'scan':
      return <svg {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/></svg>;
    case 'location':
      return <svg {...p}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'flag':
      return <svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>;
    case 'route':
      return <svg {...p}><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8 17c6-1 7-3 8-8"/><path d="M16 6H9a2.5 2.5 0 0 0 0 5h4"/></svg>;
    case 'clock':
      return <svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'calendar':
      return <svg {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>;
    case 'bolt':
      return <svg {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/></svg>;
    case 'shield':
      return <svg {...p}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/></svg>;
    case 'gauge':
      return <svg {...p}><path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-4"/><circle cx="12" cy="16" r="1.3" fill="currentColor" stroke="none"/></svg>;
    case 'phone':
      return <svg {...p}><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>;
    case 'logout':
      return <svg {...p}><path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14"/><path d="M17 8l4 4-4 4M9 12h12"/></svg>;
    case 'check':
      return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7"/></svg>;
    case 'mail':
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>;
    case 'lock':
      return <svg {...p}><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg>;
    case 'moto':
      return <svg {...p}><circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5 9 10h5l2.5 3.5"/><path d="M9 10h6.5M14 7h3l1.5 3"/></svg>;
    case 'bike':
      return <svg {...p}><circle cx="5.5" cy="16.5" r="3.2"/><circle cx="18.5" cy="16.5" r="3.2"/><path d="M5.5 16.5 10 8h4l4.5 8.5M10 8h6M9 8l-1.5 0"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor"/></svg>;
    case 'run':
      return <svg {...p}><circle cx="14" cy="5" r="1.8"/><path d="M13 9l-3 2 1 4-3 4M13 9l3 1 2-1M13 9l-1 5 4 3"/></svg>;
    case 'trek':
      return <svg {...p}><path d="M4 20l6-12 4 7M14 15l2-4 4 9"/><path d="M4 20h16"/></svg>;
    case 'bell':
      return <svg {...p}><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case 'edit':
      return <svg {...p}><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>;
    case 'crown':
      return <svg {...p}><path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z"/></svg>;
    case 'share':
      return <svg {...p}><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 11l8-4M8 13l8 4"/></svg>;
    case 'arrow-right':
      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'compass':
      return <svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z"/></svg>;
    case 'wind':
      return <svg {...p}><path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5M3 12h14a2.5 2.5 0 1 1-2.5 2.5M3 16h8"/></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

/* Brand mark — three nodes on a rounded-triangle mesh path.
   variant: 'full' (all 3 nodes, coral live node) — uses accent for the live node. */
function MeshMark({ size = 40, accent = 'var(--accent)', ring = 'var(--text)', link = 'var(--node-ring)' }) {
  // node centers on a triangle
  const N = [
    { x: 50, y: 18 },   // top
    { x: 22, y: 66 },   // bottom-left
    { x: 78, y: 66 },   // bottom-right (live)
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* rounded-triangle connecting path */}
      <path
        d="M50 22 C68 24 80 40 78 60 C76 78 60 82 50 82 C40 82 24 78 22 60 C20 40 32 24 50 22 Z"
        stroke={link} strokeWidth="5" fill="none" strokeLinecap="round"
      />
      {/* two ring nodes */}
      <circle cx={N[0].x} cy={N[0].y} r="11" stroke={ring} strokeWidth="5.5" fill="none"/>
      <circle cx={N[0].x} cy={N[0].y} r="3" fill={ring}/>
      <circle cx={N[1].x} cy={N[1].y} r="11" stroke={ring} strokeWidth="5.5" fill="none"/>
      <circle cx={N[1].x} cy={N[1].y} r="3" fill={ring}/>
      {/* live node — solid accent w/ hole */}
      <circle cx={N[2].x} cy={N[2].y} r="11.5" fill={accent}/>
      <circle cx={N[2].x} cy={N[2].y} r="4" fill="var(--bg)"/>
    </svg>
  );
}

/* Wordmark lockup */
function MeshLogo({ size = 32, showText = true, color = 'var(--text)' }) {
  return (
    <div className="row" style={{ gap: size * 0.32 }}>
      <MeshMark size={size} ring={color} />
      {showText && (
        <span className="display" style={{ fontSize: size * 0.82, fontWeight: 600, letterSpacing: '-0.03em', color }}>
          mesh
        </span>
      )}
    </div>
  );
}

const ACTIVITY_ICON = { moto: 'moto', bici: 'bike', running: 'run', trekking: 'trek' };

Object.assign(window, { Icon, MeshMark, MeshLogo, ACTIVITY_ICON });
