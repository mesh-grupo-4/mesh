/* ============================================================
   Mesh — app root: navigation stack + theming + tweaks
   ============================================================ */
const { useState: useStateApp, useMemo: useMemoApp } = React;

const TAB_KEYS = ['inicio', 'grupos', 'viajes', 'perfil'];
const AUTH_KEYS = ['onboarding', 'login', 'register', 'forgot'];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#d76655",
  "dark": true,
  "liveLayout": "inmersivo",
  "radius": 16,
  "density": "regular",
  "font": "grotesk"
}/*EDITMODE-END*/;

const FONTS = {
  grotesk: { display: "'Space Grotesk', system-ui, sans-serif", body: "'Roboto', system-ui, sans-serif" },
  manrope: { display: "'Manrope', system-ui, sans-serif", body: "'Manrope', system-ui, sans-serif" },
  system: { display: "system-ui, sans-serif", body: "system-ui, sans-serif" },
};
const DENSITY = { compact: 10, regular: 14, comfy: 18 };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [hist, setHist] = useStateApp([{ name: 'onboarding', params: {} }]);
  const cur = hist[hist.length - 1];

  const nav = useMemoApp(() => ({
    go: (name, params = {}) => setHist(h => [...h, { name, params }]),
    back: () => setHist(h => h.length > 1 ? h.slice(0, -1) : h),
    tab: (key) => setHist([{ name: key, params: {} }]),
    reset: (name, params = {}) => setHist([{ name, params }]),
  }), []);

  const isTab = TAB_KEYS.includes(cur.name);
  const isAuth = AUTH_KEYS.includes(cur.name);
  const deviceDark = t.dark || isAuth;
  const deviceBg = isAuth ? '#0c0c0c' : (t.dark ? '#0f0f0f' : '#f4f1ee');

  const fonts = FONTS[t.font] || FONTS.grotesk;
  const rootStyle = {
    '--accent': t.accent,
    '--radius': t.radius + 'px',
    '--gap': (DENSITY[t.density] || 14) + 'px',
    '--font': fonts.body,
    '--font-display': fonts.display,
  };

  const screen = (() => {
    const p = cur.params;
    switch (cur.name) {
      case 'onboarding': return <OnboardingScreen nav={nav} />;
      case 'login': return <LoginScreen nav={nav} />;
      case 'register': return <RegisterScreen nav={nav} />;
      case 'forgot': return <ForgotScreen nav={nav} />;
      case 'inicio': return <InicioScreen nav={nav} />;
      case 'grupos': return <GruposScreen nav={nav} />;
      case 'viajes': return <ViajesScreen nav={nav} />;
      case 'perfil': return <PerfilScreen nav={nav} t={t} setTweak={setTweak} />;
      case 'group': return <GroupDetailScreen nav={nav} params={p} />;
      case 'members': return <MembersScreen nav={nav} params={p} />;
      case 'invite': return <InviteScreen nav={nav} params={p} />;
      case 'createGroup': return <CreateGroupScreen nav={nav} />;
      case 'createTrip': return <CreateTripScreen nav={nav} params={p} />;
      case 'trip': return <TripDetailScreen nav={nav} params={p} />;
      case 'qr': return <QRScreen nav={nav} params={p} />;
      case 'scan': return <ScanScreen nav={nav} />;
      case 'live': return <LiveScreen nav={nav} params={p} layout={t.liveLayout === 'tablero' ? 'tablero' : 'inmersivo'} />;
      default: return <InicioScreen nav={nav} />;
    }
  })();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'transparent' }}>
      <AndroidDevice dark={deviceDark} bg={deviceBg}>
        <div className={'mesh-root ' + (t.dark ? 'theme-dark' : 'theme-light')} style={rootStyle}>
          <div key={cur.name + (cur.params?.id || '')} className="screen">{screen}</div>
          {isTab && <TabBar active={cur.name} onChange={nav.tab} />}
        </div>
      </AndroidDevice>

      <TweaksPanel>
        <TweakSection label="Marca" />
        <TweakColor label="Acento" value={t.accent}
          options={['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e']}
          onChange={v => setTweak('accent', v)} />
        <TweakSection label="Tema" />
        <TweakToggle label="Modo oscuro" value={t.dark} onChange={v => setTweak('dark', v)} />
        <TweakRadio label="Tipografía" value={t.font} options={['grotesk', 'manrope', 'system']}
          onChange={v => setTweak('font', v)} />
        <TweakSection label="Viaje en vivo" />
        <TweakRadio label="Layout" value={t.liveLayout} options={['inmersivo', 'tablero']}
          onChange={v => setTweak('liveLayout', v)} />
        <TweakButton label="Ver mapa en vivo" onClick={() => nav.go('live', { id: 'v-1' })} />
        <TweakSection label="Forma" />
        <TweakSlider label="Redondeo" value={t.radius} min={6} max={24} step={1} unit="px"
          onChange={v => setTweak('radius', v)} />
        <TweakRadio label="Densidad" value={t.density} options={['compact', 'regular', 'comfy']}
          onChange={v => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
