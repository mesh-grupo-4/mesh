/* ============================================================
   Mesh — Perfil
   ============================================================ */
const { useState: useStateProfile } = React;

function PerfilScreen({ nav, t, setTweak }) {
  const [actividad, setActividad] = useStateProfile(ME.actividad);
  const [saved, setSaved] = useStateProfile(false);
  const stats = [
    [TRIPS.filter(x => x.participantes.includes(ME.id)).length, 'Viajes'],
    [GROUPS.length, 'Grupos'],
    ['1.2k', 'Km'],
  ];
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="screen">
      <TopBar title="Perfil" bordered={false}
        right={<button className="iconbtn solid" onClick={() => setTweak('dark', !t.dark)} aria-label="Tema">
          <Icon name={t.dark ? 'bolt' : 'shield'} size={19} />
        </button>} />
      <div className="scroll pad stack fade-in" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar person={ME} size="lg" ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="h2">{fullName(ME)}</h2>
            <div className="small dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ME.email}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, display: 'flex' }}>
          {stats.map(([v, l], i) => (
            <div key={i} className="stat" style={{ flex: 1, alignItems: 'center', padding: '16px 8px', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
              <span className="stat-val">{v}</span><span className="stat-label" style={{ marginTop: 3 }}>{l}</span>
            </div>
          ))}
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <Eyebrow>Datos personales</Eyebrow>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}><Field label="Nombre" defaultValue={ME.nombre} /></div>
            <div style={{ flex: 1 }}><Field label="Apellido" defaultValue={ME.apellido} /></div>
          </div>
          <Field label="Teléfono" leading="phone" defaultValue={ME.telefono} />
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <Eyebrow>Actividad preferida</Eyebrow>
          <div className="row wrap" style={{ gap: 9 }}>
            {ACTIVIDADES.map(a => (
              <Chip key={a.id} icon={a.icon} active={actividad === a.id} onClick={() => setActividad(a.id)}>{a.label}</Chip>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <Btn variant={saved ? 'outline' : 'primary'} size="lg" block icon={saved ? 'check' : undefined} onClick={save}>
            {saved ? 'Cambios guardados' : 'Guardar cambios'}
          </Btn>
          <Btn variant="danger-outline" size="lg" block icon="logout" onClick={() => nav.reset('onboarding')}>Cerrar sesión</Btn>
        </div>
        <div className="center tiny mute" style={{ paddingBottom: 8 }}>Mesh · v1.0 — Córdoba, AR</div>
      </div>
    </div>
  );
}

Object.assign(window, { PerfilScreen });
