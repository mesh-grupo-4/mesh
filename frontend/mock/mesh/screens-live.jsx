/* ============================================================
   Mesh — Live ride (animated schematic route, moving riders)
   Two layouts via tweak `liveLayout`:  'inmersivo' | 'tablero'
   ============================================================ */
const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = React;

const ROUTE = {
  full: { vb: '0 0 360 580', d: 'M44 532 C 120 520, 96 430, 168 416 S 250 372, 232 300 S 110 232, 140 168 S 270 150, 300 92 S 332 60, 322 40' },
  card: { vb: '0 0 360 300', d: 'M36 256 C 110 250, 96 170, 168 162 S 268 200, 250 130 S 300 70, 330 44' },
};

function useLive() {
  const [riders, setRiders] = useStateLive(() => LIVE_RIDERS.map(r => ({ ...r })));
  const [t, setT] = useStateLive(0);
  useEffectLive(() => {
    let raf, last = performance.now(), start = last;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      setRiders(prev => prev.map(r => {
        if (r.status === 'detenido') return r;
        const factor = r.status === 'rezagado' ? 0.5 : 1;
        return { ...r, t: Math.min(0.985, r.t + dt * 0.011 * factor * (r.speed / 72)) };
      }));
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // live speed with gentle noise
  const withSpeed = riders.map((r, i) => ({
    ...r,
    liveSpeed: r.status === 'detenido' ? 0 : Math.max(0, Math.round(r.speed + Math.sin(t * 1.3 + i * 2) * 4)),
  }));
  return { riders: withSpeed, t };
}

function LiveMap({ riders, variant = 'full', selected, onSelect }) {
  const route = variant === 'full' ? ROUTE.full : ROUTE.card;
  const pathRef = useRefLive(null);
  const [len, setLen] = useStateLive(0);
  useEffectLive(() => { if (pathRef.current) setLen(pathRef.current.getTotalLength()); }, [variant]);
  const ptAt = (tt) => (len && pathRef.current) ? pathRef.current.getPointAtLength(Math.max(0, Math.min(1, tt)) * len) : { x: 0, y: 0 };
  const me = riders.find(r => r.me);
  const mePt = me ? ptAt(me.t) : null;

  return (
    <svg width="100%" height="100%" viewBox={route.vb} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <pattern id="lmgrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="var(--map-grid)" strokeWidth="1" />
        </pattern>
        <radialGradient id="lmglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="360" height="580" fill="url(#lmgrid)" />

      {/* route base + animated flow */}
      <path ref={pathRef} d={route.d} fill="none" stroke="var(--map-route)" strokeWidth="9" strokeLinecap="round" />
      <path d={route.d} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 11" opacity="0.85">
        <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.1s" repeatCount="indefinite" />
      </path>

      {/* mesh links: faint lines from me to others */}
      {mePt && riders.filter(r => !r.me).map(r => {
        const p = ptAt(r.t);
        return <line key={'l' + r.id} x1={mePt.x} y1={mePt.y} x2={p.x} y2={p.y} stroke="var(--accent)" strokeWidth="1" opacity="0.12" />;
      })}

      {/* start / end markers */}
      <g>
        <circle cx={ptAt(0).x} cy={ptAt(0).y} r="7" fill="var(--surface)" stroke="var(--text-dim)" strokeWidth="2.5" />
        <circle cx={ptAt(1).x} cy={ptAt(1).y} r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
        <path d={`M${ptAt(1).x - 3.5} ${ptAt(1).y} l3 3 5-6`} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* rider nodes */}
      {riders.map(r => {
        const p = ptAt(r.t); const person = byId(r.id); const isSel = selected === r.id;
        if (r.me) {
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelect && onSelect(r.id)}>
              <circle cx={p.x} cy={p.y} r="26" fill="url(#lmglow)" />
              <circle cx={p.x} cy={p.y} r="13" fill="var(--accent)">
                <animate attributeName="r" values="13;15;13" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle cx={p.x} cy={p.y} r="5" fill="var(--map-bg)" />
              <rect x={p.x - 17} y={p.y - 34} width="34" height="17" rx="8.5" fill="var(--accent)" />
              <text x={p.x} y={p.y - 22.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="var(--font)">Vos</text>
            </g>
          );
        }
        const col = r.status === 'detenido' ? 'var(--danger)' : r.status === 'rezagado' ? '#c98a3e' : 'var(--text)';
        return (
          <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelect && onSelect(r.id)} opacity={r.status === 'detenido' ? 0.85 : 1}>
            {isSel && <circle cx={p.x} cy={p.y} r="18" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />}
            <circle cx={p.x} cy={p.y} r="12" fill="var(--surface)" stroke={col} strokeWidth="3" />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)" fontFamily="var(--font)">{initials(fullName(person))}</text>
            {r.status === 'detenido' && <circle cx={p.x + 9} cy={p.y - 9} r="4.5" fill="var(--danger)" stroke="var(--map-bg)" strokeWidth="1.5" />}
          </g>
        );
      })}
    </svg>
  );
}

function statusMeta(s) {
  if (s === 'detenido') return { tone: 'badge-live', label: 'Detenido', col: 'var(--danger)' };
  if (s === 'rezagado') return { tone: 'badge-mute', label: 'Rezagado', col: '#c98a3e' };
  return { tone: 'badge-good', label: 'En ruta', col: 'var(--good)' };
}

function RiderList({ riders, selected, onSelect, compact }) {
  const sorted = [...riders].sort((a, b) => b.t - a.t);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {sorted.map(r => {
        const p = byId(r.id); const m = statusMeta(r.status); const isSel = selected === r.id;
        return (
          <button key={r.id} onClick={() => onSelect && onSelect(r.id)}
            className="row" style={{ gap: 12, padding: compact ? '8px 10px' : '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid ' + (isSel ? 'var(--accent-line)' : 'transparent'), background: r.me ? 'var(--accent-weak)' : (isSel ? 'var(--surface-2)' : 'transparent'), cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            <div style={{ position: 'relative' }}>
              <Avatar person={p} size="sm" ring={r.me} />
              <span style={{ position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderRadius: '50%', background: m.col, border: '2px solid var(--bg-elev)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="li-title" style={{ fontSize: 14 }}>{r.me ? 'Vos' : fullName(p)}</div>
              <div className="tiny dim mono">{Math.round(r.t * 92)} de 92 km</div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <div className="num" style={{ fontSize: 16, color: m.col }}>{r.liveSpeed}<span className="tiny dim" style={{ fontWeight: 400 }}> km/h</span></div>
              <div className="tiny" style={{ color: m.col }}>{m.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LiveScreen({ nav, params, layout }) {
  const { riders, t } = useLive();
  const [sel, setSel] = useStateLive(null);
  const me = riders.find(r => r.me);
  const lead = [...riders].sort((a, b) => b.t - a.t)[0];
  const remaining = Math.max(0, 92 - Math.round(me.t * 92));
  const etaMin = Math.max(1, Math.round(remaining / Math.max(30, me.liveSpeed) * 60));
  const alert = riders.find(r => r.status === 'detenido');

  const header = (
    <TopBar title="Altas Cumbres" sub={<span><span className="dot dot-pulse" style={{ display: 'inline-block', marginRight: 5, color: 'var(--danger)' }} />En vivo · {riders.length} en ruta</span>} onBack={() => nav.back()}
      right={<button className="iconbtn solid" onClick={() => nav.go('qr', { id: params?.id })}><Icon name="share" size={18} /></button>} />
  );

  if (layout === 'tablero') {
    /* ---- Layout B: dashboard ---- */
    return (
      <div className="screen">
        {header}
        <div className="scroll pad stack fade-in" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: 250 }}>
            <LiveMap riders={riders} variant="card" selected={sel} onSelect={setSel} />
            <div style={{ position: 'absolute', left: 12, top: 12 }}><Badge tone="live" pulse>EN VIVO</Badge></div>
            <button className="iconbtn solid" style={{ position: 'absolute', right: 12, bottom: 12, background: 'var(--surface)' }}><Icon name="compass" size={18} /></button>
          </div>

          <div className="row" style={{ gap: 11 }}>
            {[[me.liveSpeed, 'km/h', 'Tu ritmo'], [remaining, 'km', 'Faltan'], [etaMin + "'", '', 'ETA']].map(([v, u, l], i) => (
              <div key={i} className="card" style={{ flex: 1, padding: 14 }}>
                <div className="num" style={{ fontSize: 22 }}>{v}<span className="tiny dim" style={{ fontWeight: 400 }}> {u}</span></div>
                <div className="stat-label" style={{ marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          {alert && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--border))', background: 'var(--danger-weak)', padding: 14 }}>
              <div className="row" style={{ gap: 10 }}>
                <Icon name="bell" size={18} color="var(--danger)" />
                <span className="small" style={{ flex: 1 }}><b>{byId(alert.id).nombre}</b> se detuvo hace un momento.</span>
                <button className="btn btn-sm btn-danger-outline" style={{ padding: '6px 10px' }}>Llamar</button>
              </div>
            </div>
          )}

          <div className="stack" style={{ gap: 9 }}>
            <SectionHeader title={`Grupo · ${riders.length}`} />
            <div className="card" style={{ padding: 8 }}><RiderList riders={riders} selected={sel} onSelect={setSel} /></div>
          </div>
          <div style={{ height: 8 }} />
        </div>
        <div className="pad" style={{ borderTop: '1px solid var(--border)' }}>
          <Btn variant="danger" size="lg" block icon="flag" onClick={() => nav.reset('viajes')}>Finalizar viaje</Btn>
        </div>
      </div>
    );
  }

  /* ---- Layout A: immersive full-bleed map + bottom sheet ---- */
  return (
    <div className="screen">
      <div style={{ position: 'absolute', inset: 0, background: 'var(--map-bg)' }}>
        <LiveMap riders={riders} variant="full" selected={sel} onSelect={setSel} />
      </div>
      {/* top overlay */}
      <div style={{ position: 'relative', zIndex: 10, background: 'linear-gradient(180deg, var(--bg) 30%, transparent)' }}>{header}</div>

      {/* floating stat pill */}
      <div style={{ position: 'absolute', top: 70, left: 16, right: 16, zIndex: 8 }} className="fade-in">
        <div className="card" style={{ padding: 14, boxShadow: 'var(--shadow)', background: 'color-mix(in srgb, var(--bg-elev) 92%, transparent)', backdropFilter: 'blur(8px)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            {[[me.liveSpeed, 'km/h', 'Tu ritmo'], [remaining, 'km', 'Faltan'], [etaMin + "'", '', 'ETA'], ['#' + ([...riders].sort((a,b)=>b.t-a.t).findIndex(r=>r.me)+1), '', 'Posición']].map(([v, u, l], i) => (
              <div key={i} className="stat" style={{ flex: 1, alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
                <div className="num" style={{ fontSize: 18, whiteSpace: 'nowrap' }}>{v}{u && <span className="tiny dim" style={{ fontWeight: 400 }}> {u}</span>}</div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* recenter */}
      <div style={{ position: 'absolute', right: 16, bottom: 250, zIndex: 8 }}>
        <button className="iconbtn solid" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', width: 46, height: 46 }}><Icon name="compass" size={20} color="var(--accent)" /></button>
      </div>

      {/* bottom sheet */}
      <div className="sheet slide-up" style={{ position: 'relative', zIndex: 10 }}>
        <div className="sheet-grab" />
        {alert && (
          <div className="row" style={{ gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-weak)', marginBottom: 12 }}>
            <Icon name="bell" size={17} color="var(--danger)" />
            <span className="small" style={{ flex: 1 }}><b>{byId(alert.id).nombre}</b> se detuvo.</span>
            <button className="btn btn-sm btn-danger-outline" style={{ padding: '5px 10px' }}>Llamar</button>
          </div>
        )}
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="li-title" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>Grupo en ruta</span>
          <Badge tone="good"><span className="dot" />{riders.filter(r=>r.status==='ok').length} al día</Badge>
        </div>
        <div style={{ maxHeight: 168, overflowY: 'auto' }}><RiderList riders={riders} selected={sel} onSelect={setSel} compact /></div>
        <Btn variant="danger" size="lg" block icon="flag" style={{ marginTop: 12 }} onClick={() => nav.reset('viajes')}>Finalizar viaje</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { LiveScreen, LiveMap, RiderList, useLive });
