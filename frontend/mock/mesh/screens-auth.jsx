/* ============================================================
   Mesh — onboarding + auth
   ============================================================ */
const { useState: useStateAuth, useEffect: useEffectAuth, useRef: useRefAuth } = React;

/* Animated schematic mesh backdrop — nodes drifting on a network */
function MeshBackdrop({ live = true }) {
  const ref = useRefAuth(null);
  useEffectAuth(() => {
    const el = ref.current; if (!el) return;
    let raf, t0 = performance.now();
    const nodes = [
      { x: 18, y: 22, r: 5 }, { x: 78, y: 16, r: 4 }, { x: 88, y: 54, r: 6 },
      { x: 60, y: 40, r: 5 }, { x: 30, y: 60, r: 4 }, { x: 70, y: 80, r: 5 },
      { x: 12, y: 82, r: 4 }, { x: 46, y: 88, r: 4 },
    ];
    const links = [[0,3],[3,1],[1,2],[3,2],[0,4],[4,5],[3,5],[4,6],[6,7],[7,5],[3,4]];
    const draw = (now) => {
      const w = el.clientWidth, h = el.clientHeight;
      el.width = w * 2; el.height = h * 2; const ctx = el.getContext('2d'); ctx.scale(2,2);
      ctx.clearRect(0,0,w,h);
      const dt = (now - t0) / 1000;
      const pts = nodes.map((n, i) => ({
        x: (n.x + Math.sin(dt * 0.4 + i) * 1.6) / 100 * w,
        y: (n.y + Math.cos(dt * 0.33 + i * 1.7) * 1.6) / 100 * h,
        r: n.r,
      }));
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.4;
      links.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); });
      const pulse = (Math.sin(dt * 1.6) + 1) / 2;
      pts.forEach((p, i) => {
        if (i === 3 && live) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 + pulse * 5, 0, 7); ctx.fillStyle = 'rgba(215,102,85,0.18)'; ctx.fill();
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 1.5, 0, 7); ctx.fillStyle = '#d76655'; ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
          ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
        }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function OnboardingScreen({ nav }) {
  return (
    <div className="screen" style={{ background: '#0c0c0c' }}>
      <div style={{ position: 'absolute', inset: 0, height: '56%' }}>
        <MeshBackdrop />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, #0c0c0c 96%)' }} />
      </div>
      <div className="scroll" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="pad" style={{ paddingTop: 26 }}>
          <MeshLogo size={30} color="#fff" />
        </div>
        <div style={{ flex: 1 }} />
        <div className="pad slide-up" style={{ paddingBottom: 28, color: '#fff' }}>
          <div className="badge badge-accent" style={{ marginBottom: 18 }}>
            <span className="dot dot-pulse" />EN VIVO · GRUPAL
          </div>
          <h1 className="h1" style={{ fontSize: 38, color: '#fff', lineHeight: 1.04 }}>
            Rodá en grupo.<br />Sin perder<br />a nadie.
          </h1>
          <p className="body dim" style={{ marginTop: 16, color: 'rgba(255,255,255,0.66)', maxWidth: 300 }}>
            Mesh conecta a tu grupo en tiempo real: ubicación en vivo, ritmo y paradas — para que la salida en moto fluya.
          </p>
          <div className="stack" style={{ marginTop: 28, gap: 11 }}>
            <Btn variant="primary" size="lg" block iconRight="arrow-right" onClick={() => nav.go('register')}>Crear cuenta</Btn>
            <Btn variant="secondary" size="lg" block onClick={() => nav.go('login')}
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)', color: '#fff' }}>
              Ya tengo cuenta
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ nav }) {
  const [email, setEmail] = useStateAuth('tomas.rivero@gmail.com');
  const [pass, setPass] = useStateAuth('••••••••');
  return (
    <div className="screen">
      <TopBar title="" onBack={() => nav.back()} bordered={false} />
      <div className="scroll pad fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
        <MeshMark size={52} />
        <h1 className="h1" style={{ marginTop: 22 }}>Hola de nuevo</h1>
        <p className="body dim" style={{ marginTop: 6 }}>Ingresá para ver tus grupos y viajes.</p>
        <div className="stack" style={{ marginTop: 28 }}>
          <Field label="Email" leading="mail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
          <Field label="Contraseña" leading="lock" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', padding: '2px 4px' }} onClick={() => nav.go('forgot')}>
            ¿Olvidaste tu contraseña?
          </button>
          <Btn variant="primary" size="lg" block onClick={() => nav.reset('inicio')} style={{ marginTop: 4 }}>Ingresar</Btn>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 'auto', paddingTop: 28 }}>
          <span className="small dim">¿No tenés cuenta?</span>
          <button className="btn btn-ghost btn-sm accent-text" style={{ padding: '2px 4px' }} onClick={() => nav.go('register')}>Registrate</button>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ nav }) {
  const [step, setStep] = useStateAuth(0);
  const [activity, setActivity] = useStateAuth('moto');
  return (
    <div className="screen">
      <TopBar title="Crear cuenta" onBack={() => step === 0 ? nav.back() : setStep(0)} />
      <div className="scroll pad fade-in" key={step} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="track" style={{ marginBottom: 22 }}><i style={{ width: step === 0 ? '50%' : '100%', transition: 'width .3s' }} /></div>
        {step === 0 ? (
          <>
            <h2 className="h2">Tus datos</h2>
            <p className="body dim" style={{ marginTop: 6 }}>Así te reconocen en el grupo.</p>
            <div className="stack" style={{ marginTop: 22 }}>
              <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}><Field label="Nombre" defaultValue="Tomás" /></div>
                <div style={{ flex: 1 }}><Field label="Apellido" defaultValue="Rivero" /></div>
              </div>
              <Field label="Email" leading="mail" defaultValue="tomas.rivero@gmail.com" />
              <Field label="Teléfono" leading="phone" defaultValue="351 244-8190" />
              <Field label="Contraseña" leading="lock" type="password" defaultValue="••••••••" />
            </div>
            <Btn variant="primary" size="lg" block onClick={() => setStep(1)} style={{ marginTop: 24 }}>Continuar</Btn>
          </>
        ) : (
          <>
            <h2 className="h2">¿Qué te gusta rodar?</h2>
            <p className="body dim" style={{ marginTop: 6 }}>Lo usamos para sugerirte viajes y grupos.</p>
            <div className="stack" style={{ marginTop: 22, gap: 11 }}>
              {ACTIVIDADES.map(a => (
                <button key={a.id} className={'li' + (activity === a.id ? ' card-accent' : '')}
                  style={{ borderColor: activity === a.id ? 'var(--accent-line)' : 'var(--border)' }}
                  onClick={() => setActivity(a.id)}>
                  <ActivityTile activity={a.id} />
                  <div style={{ flex: 1 }}><div className="li-title">{a.label}</div></div>
                  {activity === a.id && <Icon name="check" size={20} color="var(--accent)" />}
                </button>
              ))}
            </div>
            <Btn variant="primary" size="lg" block onClick={() => nav.reset('inicio')} style={{ marginTop: 24 }}>Crear mi cuenta</Btn>
          </>
        )}
      </div>
    </div>
  );
}

function ForgotScreen({ nav }) {
  const [sent, setSent] = useStateAuth(false);
  return (
    <div className="screen">
      <TopBar title="Recuperar acceso" onBack={() => nav.back()} />
      <div className="scroll pad fade-in">
        {!sent ? (
          <>
            <h2 className="h2" style={{ marginTop: 8 }}>¿Olvidaste tu contraseña?</h2>
            <p className="body dim" style={{ marginTop: 6 }}>Te enviamos un enlace para restablecerla.</p>
            <div className="stack" style={{ marginTop: 22 }}>
              <Field label="Email" leading="mail" defaultValue="tomas.rivero@gmail.com" />
              <Btn variant="primary" size="lg" block onClick={() => setSent(true)}>Enviar enlace</Btn>
            </div>
          </>
        ) : (
          <div className="center" style={{ marginTop: 48 }}>
            <div style={{ display: 'inline-flex', padding: 18, borderRadius: '50%', background: 'var(--accent-weak)', color: 'var(--accent)' }}>
              <Icon name="mail" size={34} />
            </div>
            <h2 className="h2" style={{ marginTop: 18 }}>Revisá tu correo</h2>
            <p className="body dim" style={{ marginTop: 8 }}>Enviamos un enlace a tu email para que vuelvas a entrar.</p>
            <Btn variant="secondary" block onClick={() => nav.go('login')} style={{ marginTop: 24 }}>Volver a ingresar</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingScreen, LoginScreen, RegisterScreen, ForgotScreen, MeshBackdrop });
