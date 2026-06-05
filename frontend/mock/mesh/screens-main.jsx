/* ============================================================
   Mesh — Inicio (home) + Grupos + detalle + miembros + invitar
   ============================================================ */
const { useState: useStateMain } = React;

function InicioScreen({ nav }) {
  const enCurso = TRIPS.find(t => t.estado === 'en_curso');
  const prox = TRIPS.filter(t => t.estado === 'planificado').slice(0, 2);
  return (
    <div className="screen">
      <div className="topbar" style={{ paddingTop: 14 }}>
        <MeshMark size={30} />
        <div style={{ flex: 1 }} />
        <button className="iconbtn solid" onClick={() => nav.go('scan')} aria-label="Escanear"><Icon name="scan" size={20} /></button>
        <button className="iconbtn solid" aria-label="Notificaciones" style={{ position: 'relative' }}>
          <Icon name="bell" size={20} />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 2px var(--bg)' }} />
        </button>
      </div>
      <div className="scroll pad stack fade-in" style={{ gap: 22 }}>
        <div>
          <div className="eyebrow">{fechaLarga(new Date().toISOString())}</div>
          <h1 className="h1" style={{ marginTop: 6 }}>Hola, {ME.nombre} 👋</h1>
        </div>

        {enCurso && (
          <div className="card card-press" onClick={() => nav.go('live', { id: enCurso.id })}
            style={{ background: 'linear-gradient(150deg, color-mix(in srgb, var(--accent) 26%, var(--surface)), var(--surface))', borderColor: 'var(--accent-line)', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 18 }}>
              <div className="row-between">
                <Badge tone="live" pulse>EN VIVO</Badge>
                <span className="small mono dim">{enCurso.distancia} km</span>
              </div>
              <h3 className="h3" style={{ marginTop: 14 }}>{enCurso.titulo}</h3>
              <div className="row" style={{ marginTop: 6, gap: 7 }}>
                <Icon name="route" size={15} color="var(--text-dim)" />
                <span className="small dim">{enCurso.salida} → {enCurso.destino}</span>
              </div>
              <div className="row-between" style={{ marginTop: 16 }}>
                <AvatarStack ids={enCurso.participantes} max={4} />
                <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>Ver mapa en vivo<Icon name="arrow-right" size={15} /></span>
              </div>
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 11 }}>
          <button className="card card-press" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }} onClick={() => nav.go('createTrip')}>
            <div style={{ color: 'var(--accent)' }}><Icon name="plus" size={24} /></div>
            <span className="li-title" style={{ fontSize: 14.5 }}>Nuevo viaje</span>
          </button>
          <button className="card card-press" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }} onClick={() => nav.go('scan')}>
            <div style={{ color: 'var(--accent)' }}><Icon name="qr" size={24} /></div>
            <span className="li-title" style={{ fontSize: 14.5 }}>Unirme por QR</span>
          </button>
        </div>

        <div className="stack" style={{ gap: 11 }}>
          <SectionHeader title="Próximos viajes" action="Ver todos" onAction={() => nav.tab('viajes')} />
          {prox.map(t => <TripRow key={t.id} trip={t} onClick={() => nav.go('trip', { id: t.id })} />)}
        </div>

        <div className="stack" style={{ gap: 11 }}>
          <SectionHeader title="Tus grupos" action="Ver todos" onAction={() => nav.tab('grupos')} />
          {GROUPS.slice(0, 2).map(g => <GroupRow key={g.id} group={g} onClick={() => nav.go('group', { id: g.id })} />)}
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function TripRow({ trip, onClick }) {
  const tone = trip.estado === 'en_curso' ? 'live' : trip.estado === 'planificado' ? 'accent' : 'mute';
  return (
    <div className="li" onClick={onClick}>
      <ActivityTile activity={trip.actividad} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="li-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.titulo}</div>
        <div className="li-sub">{fechaCorta(trip.fecha)} · {hora(trip.fecha)} · {trip.distancia} km</div>
      </div>
      <Badge tone={tone} pulse={trip.estado === 'en_curso'}>{estadoLabel[trip.estado]}</Badge>
    </div>
  );
}

function GroupRow({ group, onClick }) {
  return (
    <div className="li" onClick={onClick}>
      <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: 'color-mix(in srgb,' + group.color + ' 20%, transparent)', color: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="users" size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="li-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.nombre}</div>
        <div className="li-sub">{group.miembros.length} miembros{group.rol === 'lider' ? ' · Líder' : ''}</div>
      </div>
      <AvatarStack ids={group.miembros} max={3} />
    </div>
  );
}

function GruposScreen({ nav }) {
  return (
    <div className="screen">
      <TopBar title="Grupos" bordered={false}
        right={<button className="iconbtn solid" onClick={() => nav.go('scan')}><Icon name="scan" size={20} /></button>} />
      <div className="scroll pad stack fade-in" style={{ gap: 18 }}>
        {INVITES.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <Eyebrow>Invitaciones pendientes</Eyebrow>
            {INVITES.map(inv => (
              <div key={inv.id} className="card" style={{ borderColor: 'var(--accent-line)' }}>
                <div className="row">
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-weak)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="li-title">{inv.grupo}</div>
                    <div className="li-sub">{inv.de} te invitó</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 10, marginTop: 14 }}>
                  <Btn variant="primary" size="sm" block style={{ flex: 1 }}>Aceptar</Btn>
                  <Btn variant="secondary" size="sm" block style={{ flex: 1 }}>Rechazar</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="row-between">
          <span className="small dim">{GROUPS.length} grupos</span>
        </div>
        <div className="stack" style={{ gap: 11 }}>
          {GROUPS.map(g => <GroupRow key={g.id} group={g} onClick={() => nav.go('group', { id: g.id })} />)}
        </div>
        <div style={{ height: 60 }} />
      </div>
      <button className="fab" onClick={() => nav.go('createGroup')}><Icon name="plus" size={20} />Crear grupo</button>
    </div>
  );
}

function GroupDetailScreen({ nav, params }) {
  const g = GROUPS.find(x => x.id === params.id) || GROUPS[0];
  const lider = g.rol === 'lider';
  const viajesGrupo = TRIPS.filter(t => t.grupo === g.nombre);
  return (
    <div className="screen">
      <TopBar title={g.nombre} onBack={() => nav.back()}
        right={lider && <button className="iconbtn"><Icon name="edit" size={19} /></button>} />
      <div className="scroll fade-in">
        <div className="pad stack" style={{ gap: 18 }}>
          <div className="card" style={{ background: 'color-mix(in srgb,' + g.color + ' 14%, var(--surface))', borderColor: 'color-mix(in srgb,' + g.color + ' 35%, var(--border))' }}>
            <div className="row-between">
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'color-mix(in srgb,' + g.color + ' 26%, transparent)', color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={26} /></div>
              {lider && <Badge tone="accent"><Icon name="crown" size={13} />Líder</Badge>}
            </div>
            <h2 className="h2" style={{ marginTop: 14 }}>{g.nombre}</h2>
            <div className="row" style={{ marginTop: 12, gap: 20 }}>
              <div className="stat"><span className="stat-val">{g.miembros.length}</span><span className="stat-label">Miembros</span></div>
              <div className="stat"><span className="stat-val">{g.viajes}</span><span className="stat-label">Viajes</span></div>
              <div className="stat"><span className="stat-val">{fechaCorta(g.fecha)}</span><span className="stat-label">Desde</span></div>
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <Btn variant="primary" block icon="plus" onClick={() => nav.go('createTrip', { grupo: g.id })}>Nuevo viaje</Btn>
            {lider && <Btn variant="secondary" icon="share" onClick={() => nav.go('invite', { id: g.id })} style={{ paddingLeft: 16, paddingRight: 16 }} />}
          </div>

          <div className="li" onClick={() => nav.go('members', { id: g.id })}>
            <div className="row" style={{ flex: 1 }}>
              <AvatarStack ids={g.miembros} max={4} />
              <div style={{ flex: 1 }}><div className="li-title">Miembros</div><div className="li-sub">Ver roles y permisos</div></div>
            </div>
            <Icon name="chevron" size={18} color="var(--text-mute)" />
          </div>

          {lider && (
            <div className="li" onClick={() => nav.go('invite', { id: g.id })}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-weak)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="share" size={19} /></div>
              <div style={{ flex: 1 }}><div className="li-title">Invitar personas</div><div className="li-sub">Por QR o desde otros grupos</div></div>
              <Icon name="chevron" size={18} color="var(--text-mute)" />
            </div>
          )}
        </div>

        <div className="pad-x stack" style={{ gap: 11 }}>
          <SectionHeader title="Viajes del grupo" />
          {viajesGrupo.length ? viajesGrupo.map(t => <TripRow key={t.id} trip={t} onClick={() => nav.go('trip', { id: t.id })} />)
            : <p className="small dim">Todavía no hay viajes en este grupo.</p>}
        </div>

        <div className="pad">
          <div className="danger-zone">
            <div className="row" style={{ gap: 8, color: 'var(--danger)' }}><Icon name="shield" size={17} /><span className="li-title" style={{ color: 'var(--danger)', fontSize: 14, whiteSpace: 'nowrap' }}>Zona de peligro</span></div>
            <p className="tiny dim" style={{ marginTop: 6, marginBottom: 12 }}>Estas acciones son permanentes y no se pueden deshacer.</p>
            <Btn variant="danger-outline" size="sm" block>{lider ? 'Eliminar grupo' : 'Abandonar grupo'}</Btn>
          </div>
        </div>
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}

function MembersScreen({ nav, params }) {
  const g = GROUPS.find(x => x.id === params.id) || GROUPS[0];
  return (
    <div className="screen">
      <TopBar title="Miembros" sub={g.nombre} onBack={() => nav.back()}
        right={g.rol === 'lider' && <button className="iconbtn" onClick={() => nav.go('invite', { id: g.id })}><Icon name="plus" size={21} /></button>} />
      <div className="scroll pad stack fade-in" style={{ gap: 10 }}>
        <Eyebrow>{g.miembros.length} integrantes</Eyebrow>
        {g.miembros.map(id => {
          const p = byId(id); const rol = ROLES[id] || 'participante'; const me = id === ME.id;
          return (
            <div key={id} className="li" style={{ cursor: 'default' }}>
              <Avatar person={p} />
              <div style={{ flex: 1 }}>
                <div className="li-title">{fullName(p)}{me && ' (vos)'}</div>
                <div className="li-sub">{rol === 'lider' ? 'Líder del grupo' : 'Participante'}</div>
              </div>
              {rol === 'lider'
                ? <Badge tone="accent"><Icon name="crown" size={13} />Líder</Badge>
                : g.rol === 'lider' && !me && <button className="iconbtn"><Icon name="chevron-down" size={18} /></button>}
            </div>
          );
        })}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function InviteScreen({ nav, params }) {
  const g = GROUPS.find(x => x.id === params.id) || GROUPS[0];
  const [tab, setTab] = useStateMain('qr');
  const candidatos = PEOPLE.filter(p => !g.miembros.includes(p.id));
  const [sel, setSel] = useStateMain(new Set());
  const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="screen">
      <TopBar title="Invitar personas" sub={g.nombre} onBack={() => nav.back()} />
      <div className="pad-x" style={{ paddingTop: 4 }}>
        <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 4, gap: 4 }}>
          {[['qr', 'Por QR'], ['grupos', 'Desde grupos']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 'none', cursor: 'pointer', padding: '10px 0', borderRadius: 'calc(var(--radius-sm) - 2px)', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)', background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--text)' : 'var(--text-dim)', boxShadow: tab === k ? 'var(--shadow-sm)' : 'none' }}>{l}</button>
          ))}
        </div>
      </div>
      {tab === 'qr' ? (
        <div className="scroll pad fade-in center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="body dim" style={{ marginTop: 8, maxWidth: 280 }}>Mostrá este código para que se unan al instante.</p>
          <div className="qr-box" style={{ marginTop: 22, boxShadow: 'var(--shadow)' }}><FauxQR seed={g.id + 'invite'} size={188} /></div>
          <div className="badge badge-mute mono" style={{ marginTop: 18, fontSize: 14, padding: '8px 16px' }}>MESH-{g.id.toUpperCase()}-7K2</div>
          <Btn variant="secondary" icon="share" style={{ marginTop: 20 }}>Compartir enlace</Btn>
        </div>
      ) : (
        <div className="scroll pad fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
          <p className="small dim" style={{ marginBottom: 14 }}>Sumá integrantes desde tus otros grupos. Cada persona recibe una invitación.</p>
          <div className="stack" style={{ gap: 10 }}>
            {candidatos.map(p => {
              const on = sel.has(p.id);
              return (
                <button key={p.id} className={'li' + (on ? ' card-accent' : '')} style={{ borderColor: on ? 'var(--accent-line)' : 'var(--border)' }} onClick={() => toggle(p.id)}>
                  <Avatar person={p} size="sm" />
                  <div style={{ flex: 1, textAlign: 'left' }}><div className="li-title" style={{ fontSize: 14.5 }}>{fullName(p)}</div></div>
                  <div style={{ width: 24, height: 24, borderRadius: 8, border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), background: on ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{on && <Icon name="check" size={15} stroke={3} />}</div>
                </button>
              );
            })}
          </div>
          <div style={{ height: 12 }} />
        </div>
      )}
      {tab === 'grupos' && (
        <div className="pad" style={{ borderTop: '1px solid var(--border)' }}>
          <Btn variant="primary" size="lg" block disabled={sel.size === 0} onClick={() => nav.back()}>
            {sel.size === 0 ? 'Elegí a quién invitar' : `Invitar ${sel.size} ${sel.size === 1 ? 'persona' : 'personas'}`}
          </Btn>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { InicioScreen, GruposScreen, GroupDetailScreen, MembersScreen, InviteScreen, TripRow, GroupRow });
