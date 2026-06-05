/* ============================================================
   Mesh — Viajes list, crear viaje, detalle, QR, escanear, crear grupo
   ============================================================ */
const { useState: useStateTrips, useEffect: useEffectTrips } = React;

function ViajesScreen({ nav }) {
  const [filtro, setFiltro] = useStateTrips('todos');
  const orden = { en_curso: 0, planificado: 1, finalizado: 2 };
  const lista = TRIPS
    .filter(t => filtro === 'todos' || t.estado === filtro)
    .sort((a, b) => orden[a.estado] - orden[b.estado]);
  return (
    <div className="screen">
      <TopBar title="Viajes" bordered={false} />
      <div className="pad-x">
        <div className="chip-row">
          {[['todos', 'Todos'], ['en_curso', 'En curso'], ['planificado', 'Próximos'], ['finalizado', 'Pasados']].map(([k, l]) => (
            <Chip key={k} active={filtro === k} onClick={() => setFiltro(k)}>{l}</Chip>
          ))}
        </div>
      </div>
      <div className="scroll pad stack fade-in" style={{ gap: 12, paddingTop: 16 }}>
        {lista.map(t => (
          <div key={t.id} className="card card-press" onClick={() => nav.go(t.estado === 'en_curso' ? 'live' : 'trip', { id: t.id })}>
            <div className="row-between">
              <div className="row" style={{ gap: 12 }}>
                <ActivityTile activity={t.actividad} />
                <div>
                  <div className="li-title">{t.titulo}</div>
                  <div className="li-sub">{t.grupo}</div>
                </div>
              </div>
              <Badge tone={t.estado === 'en_curso' ? 'live' : t.estado === 'planificado' ? 'accent' : 'mute'} pulse={t.estado === 'en_curso'}>{estadoLabel[t.estado]}</Badge>
            </div>
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="row-between">
              <div className="row" style={{ gap: 7 }}>
                <Icon name="route" size={15} color="var(--text-dim)" />
                <span className="small dim">{t.salida} → {t.destino}</span>
              </div>
              <span className="small mono dim">{fechaCorta(t.fecha)} · {hora(t.fecha)}</span>
            </div>
            <div className="row-between" style={{ marginTop: 12 }}>
              <AvatarStack ids={t.participantes} max={4} />
              <span className="small mono dim">{t.distancia} km · {t.duracion}</span>
            </div>
          </div>
        ))}
        <div style={{ height: 60 }} />
      </div>
      <button className="fab" onClick={() => nav.go('createTrip')}><Icon name="plus" size={20} />Nuevo viaje</button>
    </div>
  );
}

function CreateTripScreen({ nav, params }) {
  const [step, setStep] = useStateTrips(0);
  const [actividad, setActividad] = useStateTrips('moto');
  const [modalidad, setModalidad] = useStateTrips('grupal');
  const [grupos, setGrupos] = useStateTrips(new Set(params?.grupo ? [params.grupo] : []));
  const [salida, setSalida] = useStateTrips('Villa Carlos Paz');
  const [destino, setDestino] = useStateTrips('Mina Clavero');
  const toggleG = (id) => setGrupos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const next = () => step < 2 ? setStep(step + 1) : nav.go('qr', { id: 'v-new' });

  return (
    <div className="screen">
      <TopBar title="Nuevo viaje" onBack={() => step === 0 ? nav.back() : setStep(step - 1)} />
      <div className="pad-x"><div className="track"><i style={{ width: `${(step + 1) / 3 * 100}%`, transition: 'width .3s' }} /></div></div>
      <div className="scroll pad fade-in" key={step} style={{ display: 'flex', flexDirection: 'column' }}>
        {step === 0 && (
          <div className="stack" style={{ gap: 18 }}>
            <div><h2 className="h2">¿Qué van a hacer?</h2><p className="body dim" style={{ marginTop: 6 }}>Elegí la actividad de la salida.</p></div>
            <div className="row wrap" style={{ gap: 11 }}>
              {ACTIVIDADES.map(a => (
                <button key={a.id} className={'card card-press' + (actividad === a.id ? ' card-accent' : '')} style={{ flex: '1 1 44%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', borderColor: actividad === a.id ? 'var(--accent-line)' : 'var(--border)' }} onClick={() => setActividad(a.id)}>
                  <ActivityTile activity={a.id} />
                  <span className="li-title">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="stack" style={{ gap: 18 }}>
            <div><h2 className="h2">El recorrido</h2><p className="body dim" style={{ marginTop: 6 }}>Definí salida y destino.</p></div>
            <Field label="Punto de salida" leading="location" value={salida} onChange={e => setSalida(e.target.value)} />
            <Field label="Destino" leading="flag" value={destino} onChange={e => setDestino(e.target.value)} />
            <div className="row" style={{ gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Fecha" leading="calendar" defaultValue="Vie 12 jun" /></div>
              <div style={{ flex: 1 }}><Field label="Hora" leading="clock" defaultValue="09:00" /></div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="stack" style={{ gap: 18 }}>
            <div><h2 className="h2">¿Quiénes van?</h2><p className="body dim" style={{ marginTop: 6 }}>Invitá grupos en bloque o sumá gente después por QR.</p></div>
            <div className="row" style={{ gap: 10 }}>
              {[['grupal', 'Grupal', 'Invitar por grupos'], ['individual', 'Individual', 'Sin invitados']].map(([k, t, s]) => (
                <button key={k} className={'card card-press' + (modalidad === k ? ' card-accent' : '')} style={{ flex: 1, padding: 14, textAlign: 'left', borderColor: modalidad === k ? 'var(--accent-line)' : 'var(--border)' }} onClick={() => setModalidad(k)}>
                  <div className="li-title">{t}</div><div className="li-sub">{s}</div>
                </button>
              ))}
            </div>
            {modalidad === 'grupal' && (
              <div className="stack" style={{ gap: 10 }}>
                <Eyebrow>Grupos para invitar</Eyebrow>
                {GROUPS.map(g => {
                  const on = grupos.has(g.id);
                  return (
                    <button key={g.id} className={'li' + (on ? ' card-accent' : '')} style={{ borderColor: on ? 'var(--accent-line)' : 'var(--border)' }} onClick={() => toggleG(g.id)}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'color-mix(in srgb,' + g.color + ' 20%, transparent)', color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={18} /></div>
                      <div style={{ flex: 1, textAlign: 'left' }}><div className="li-title" style={{ fontSize: 14.5 }}>{g.nombre}</div><div className="li-sub">{g.miembros.length} miembros</div></div>
                      <div style={{ width: 24, height: 24, borderRadius: 8, border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), background: on ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{on && <Icon name="check" size={15} stroke={3} />}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
      <div className="pad" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn variant="primary" size="lg" block onClick={next} iconRight={step === 2 ? 'qr' : 'arrow-right'}>
          {step === 2 ? 'Crear y generar QR' : 'Continuar'}
        </Btn>
      </div>
    </div>
  );
}

function TripDetailScreen({ nav, params }) {
  const t = TRIPS.find(x => x.id === params.id) || TRIPS[1];
  const planificado = t.estado === 'planificado';
  return (
    <div className="screen">
      <TopBar title="Viaje" onBack={() => nav.back()} right={<button className="iconbtn" onClick={() => nav.go('qr', { id: t.id })}><Icon name="share" size={19} /></button>} />
      <div className="scroll fade-in">
        <div className="pad stack" style={{ gap: 18 }}>
          <div>
            <div className="row" style={{ gap: 10 }}>
              <Badge tone={t.estado === 'en_curso' ? 'live' : planificado ? 'accent' : 'mute'} pulse={t.estado === 'en_curso'}>{estadoLabel[t.estado]}</Badge>
              <span className="small dim mono">{t.grupo}</span>
            </div>
            <h1 className="h1" style={{ marginTop: 12, fontSize: 27 }}>{t.titulo}</h1>
          </div>

          {/* schematic route preview */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <RouteMini activity={t.actividad} />
            <div className="row-between" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 8 }}><span className="dot" style={{ background: 'var(--text-dim)' }} /><span className="small">{t.salida}</span></div>
              <Icon name="arrow-right" size={16} color="var(--text-mute)" />
              <div className="row" style={{ gap: 8 }}><span className="dot" style={{ background: 'var(--accent)' }} /><span className="small">{t.destino}</span></div>
            </div>
          </div>

          <div className="row" style={{ gap: 11 }}>
            {[['gauge', t.distancia + ' km', 'Distancia'], ['clock', t.duracion, 'Duración'], ['calendar', fechaCorta(t.fecha), hora(t.fecha)]].map(([ic, v, l], i) => (
              <div key={i} className="card" style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Icon name={ic} size={19} color="var(--accent)" />
                <div><div className="num" style={{ fontSize: 17 }}>{v}</div><div className="stat-label">{l}</div></div>
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 11 }}>
            <SectionHeader title={`Participantes · ${t.participantes.length}`} />
            {t.participantes.map(id => {
              const p = byId(id);
              return (
                <div key={id} className="row" style={{ gap: 12 }}>
                  <Avatar person={p} size="sm" />
                  <span className="li-title" style={{ fontSize: 14.5, flex: 1 }}>{fullName(p)}{id === ME.id && ' (vos)'}</span>
                  <Badge tone="good"><Icon name="check" size={12} />Confirmó</Badge>
                </div>
              );
            })}
          </div>
          <div style={{ height: 8 }} />
        </div>
      </div>
      <div className="pad" style={{ borderTop: '1px solid var(--border)' }}>
        {t.estado === 'finalizado'
          ? <Btn variant="secondary" size="lg" block icon="route">Ver resumen del recorrido</Btn>
          : <Btn variant="primary" size="lg" block icon={planificado ? 'bolt' : 'location'} onClick={() => nav.go('live', { id: t.id })}>
              {planificado ? 'Iniciar viaje en vivo' : 'Ver mapa en vivo'}
            </Btn>}
      </div>
    </div>
  );
}

// Mini schematic route used in trip detail
function RouteMini({ activity }) {
  return (
    <div style={{ position: 'relative', height: 150, background: 'var(--map-bg)' }}>
      <svg width="100%" height="100%" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
        <defs><pattern id="rmgrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="var(--map-grid)" strokeWidth="1" /></pattern></defs>
        <rect width="320" height="150" fill="url(#rmgrid)" />
        <path d="M30 118 C 90 110, 80 50, 150 56 S 250 96, 292 34" fill="none" stroke="var(--map-route)" strokeWidth="8" strokeLinecap="round" />
        <path d="M30 118 C 90 110, 80 50, 150 56 S 250 96, 292 34" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" opacity="0.9" />
        <circle cx="30" cy="118" r="6" fill="var(--text-dim)" />
        <circle cx="292" cy="34" r="7" fill="var(--accent)" />
        <circle cx="292" cy="34" r="3" fill="var(--bg)" />
      </svg>
    </div>
  );
}

function QRScreen({ nav, params }) {
  return (
    <div className="screen">
      <TopBar title="Invitar al viaje" onBack={() => nav.back()} />
      <div className="scroll pad fade-in center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'var(--accent-weak)', color: 'var(--accent)', marginTop: 10 }}><Icon name="check" size={30} stroke={2.5} /></div>
        <h2 className="h2" style={{ marginTop: 16 }}>¡Viaje creado!</h2>
        <p className="body dim" style={{ marginTop: 6, maxWidth: 280 }}>Que escaneen este QR para sumarse a la salida.</p>
        <div className="qr-box" style={{ marginTop: 24, boxShadow: 'var(--shadow)' }}><FauxQR seed={(params?.id || 'v') + 'trip'} size={190} /></div>
        <div className="badge badge-mute mono" style={{ marginTop: 18, fontSize: 14, padding: '8px 16px' }}>MESH·VIAJE·9F4Q</div>
        <div className="stack" style={{ marginTop: 24, width: '100%', gap: 10 }}>
          <Btn variant="secondary" size="lg" block icon="share">Compartir enlace</Btn>
          <Btn variant="primary" size="lg" block onClick={() => nav.reset('viajes')}>Listo</Btn>
        </div>
      </div>
    </div>
  );
}

function ScanScreen({ nav }) {
  const [found, setFound] = useStateTrips(false);
  useEffectTrips(() => { const id = setTimeout(() => setFound(true), 1800); return () => clearTimeout(id); }, []);
  return (
    <div className="screen" style={{ background: '#0a0a0a' }}>
      <TopBar title="" onBack={() => nav.back()} bordered={false} right={<span className="small" style={{ color: 'rgba(255,255,255,0.6)', marginRight: 8 }}>Escaneá un QR</span>} />
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}><MeshBackdrop /></div>
        <div style={{ position: 'relative', width: 230, height: 230 }}>
          {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h],i)=>(
            <span key={i} style={{ position:'absolute', [v]:0, [h]:0, width:38, height:38, [`border${v[0].toUpperCase()+v.slice(1)}`]:'3px solid var(--accent)', [`border${h[0].toUpperCase()+h.slice(1)}`]:'3px solid var(--accent)', borderRadius: v==='top'&&h==='left'?'10px 0 0 0':v==='top'?'0 10px 0 0':h==='left'?'0 0 0 10px':'0 0 10px 0' }} />
          ))}
          {!found
            ? <div style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 2, background: 'var(--accent)', boxShadow: '0 0 16px var(--accent)', animation: 'scanline 1.8s ease-in-out infinite' }} />
            : <div className="fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: '#fff', padding: 10, borderRadius: 14 }}><FauxQR seed="scanned" size={150} /></div></div>}
        </div>
        <style>{`@keyframes scanline{0%,100%{top:18%}50%{top:82%}}`}</style>
      </div>
      <div className="pad" style={{ background: '#0a0a0a' }}>
        {found ? (
          <div className="card slide-up" style={{ background: '#161616', borderColor: '#262626' }}>
            <div className="row"><div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-weak)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={20} /></div>
              <div style={{ flex: 1 }}><div className="li-title" style={{ color: '#fff' }}>Trail Riders Córdoba</div><div className="li-sub">Invitación de Mateo F.</div></div></div>
            <Btn variant="primary" block style={{ marginTop: 14 }} onClick={() => nav.reset('grupos')}>Unirme al grupo</Btn>
          </div>
        ) : <p className="center small" style={{ color: 'rgba(255,255,255,0.5)' }}>Apuntá la cámara al código QR de Mesh</p>}
      </div>
    </div>
  );
}

function CreateGroupScreen({ nav }) {
  const [nombre, setNombre] = useStateTrips('');
  return (
    <div className="screen">
      <TopBar title="Nuevo grupo" onBack={() => nav.back()} />
      <div className="scroll pad fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="h2" style={{ marginTop: 8 }}>Creá tu grupo</h2>
        <p className="body dim" style={{ marginTop: 6 }}>Después invitás gente por QR o desde otros grupos.</p>
        <div className="stack" style={{ marginTop: 22 }}>
          <Field label="Nombre del grupo" leading="users" placeholder="Ej: Trail Riders Córdoba" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="pad" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn variant="primary" size="lg" block disabled={!nombre.trim()} onClick={() => nav.reset('grupos')}>Crear grupo</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { ViajesScreen, CreateTripScreen, TripDetailScreen, QRScreen, ScanScreen, CreateGroupScreen, RouteMini });
