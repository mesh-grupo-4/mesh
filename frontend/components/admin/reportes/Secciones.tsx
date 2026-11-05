import { StyleSheet, Text } from 'react-native'

import {
  BarrasHorizontales,
  FilaIndicadores,
  GraficoLineas,
  Indicador,
  MapaCalor,
  TarjetaGrafico,
  fmtNum,
  fmtPct,
  useVizTheme,
} from '@/components/admin/charts'
import type {
  ReporteAdopcion,
  ReporteComunidad,
  ReporteCrecimiento,
  ReporteDestinos,
  ReporteGastos,
  ReporteResumen,
  ReporteRetencion,
  ReporteSeguridad,
  ReporteViajes,
} from '@/lib/reportesApi'
import {
  DIAS_SEMANA,
  rotulo,
  tablasComunidad,
  tablasCrecimiento,
  tablasDestinos,
  tablasGastos,
  tablasRetencion,
  tablasSeguridad,
  tablasViajes,
} from '@/lib/reportesTablas'

/**
 * Secciones del panel de reportería. Cada número va con su definición a la vista:
 * un tablero que se presenta a un directorio no puede dejar dudas sobre qué mide.
 */

function Nota({ children }: { children: string }) {
  const t = useVizTheme()
  return <Text style={[styles.nota, { color: t.textMute }]}>{children}</Text>
}

const pesos = (n: number | null) => (n == null ? '—' : `$ ${fmtNum(n, 0)}`)

// ── Resumen ejecutivo ─────────────────────────────────────────────────────

export function SeccionResumen({ r }: { r: ReporteResumen }) {
  const k = r.kpis
  return (
    <>
      <Nota>{`Período ${r.periodo.desde} a ${r.periodo.hasta}, comparado con ${r.periodo_anterior.desde} a ${r.periodo_anterior.hasta}.`}</Nota>
      <FilaIndicadores>
        <Indicador label="Usuarios activos" valor={fmtNum(k.usuarios_activos.actual)} variacion={k.usuarios_activos.variacion_pct} />
        <Indicador label="Altas de usuarios" valor={fmtNum(k.altas.actual)} variacion={k.altas.variacion_pct} />
        <Indicador label="Viajes iniciados" valor={fmtNum(k.viajes_iniciados.actual)} variacion={k.viajes_iniciados.variacion_pct} />
        <Indicador label="Viajes finalizados" valor={fmtNum(k.viajes_finalizados.actual)} variacion={k.viajes_finalizados.variacion_pct} />
        <Indicador label="Km recorridos" valor={fmtNum(k.km_recorridos.actual)} variacion={k.km_recorridos.variacion_pct} />
        <Indicador label="Horas de actividad" valor={fmtNum(k.horas_actividad.actual)} variacion={k.horas_actividad.variacion_pct} />
        <Indicador label="Grupos creados" valor={fmtNum(k.grupos_creados.actual)} variacion={k.grupos_creados.variacion_pct} />
        <Indicador
          label="Incidentes detectados"
          valor={fmtNum(k.incidentes_detectados.actual)}
          variacion={k.incidentes_detectados.variacion_pct}
          invertir
        />
        <Indicador
          label="Tasa de realización"
          valor={fmtPct(r.tasa_realizacion.actual)}
          variacion={r.tasa_realizacion.variacion_pp}
          unidadVariacion="pp"
          pie="Viajes programados que efectivamente arrancaron"
        />
      </FilaIndicadores>
      <Nota>
        Usuario activo: participó en al menos un viaje que arrancó en el período. Km recorridos: suma de la
        distancia real de cada viaje (no por persona).
      </Nota>
    </>
  )
}

// ── Crecimiento ───────────────────────────────────────────────────────────

export function SeccionCrecimiento({ r }: { r: ReporteCrecimiento }) {
  const [serie, , preferida] = tablasCrecimiento(r)
  const g = r.periodo.granularidad
  return (
    <>
      <FilaIndicadores>
        <Indicador
          label="Activación de cuentas nuevas"
          valor={fmtPct(r.activacion.tasa)}
          pie={`${fmtNum(r.activacion.activados)} de ${fmtNum(r.activacion.altas)} ya participaron en un viaje`}
        />
        <Indicador
          label="Días hasta el primer viaje"
          valor={r.activacion.mediana_dias_hasta_primer_viaje == null ? '—' : fmtNum(r.activacion.mediana_dias_hasta_primer_viaje, 1)}
          pie="Mediana desde el alta"
        />
      </FilaIndicadores>
      <TarjetaGrafico titulo="Altas y usuarios activos" sub="Por período" tabla={serie}>
        <GraficoLineas
          datos={r.serie}
          granularidad={g}
          series={[
            { clave: 'usuarios_activos', label: 'Activos' },
            { clave: 'altas', label: 'Altas' },
          ]}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Cuentas totales" sub="Acumulado al cierre de cada período" tabla={serie}>
        <GraficoLineas datos={r.serie} granularidad={g} series={[{ clave: 'usuarios_totales', label: 'Cuentas' }]} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Actividad preferida" sub="Todas las cuentas, hoy" tabla={preferida}>
        <BarrasHorizontales items={r.actividad_preferida.map((f) => ({ label: rotulo(f.actividad), valor: f.cantidad }))} />
      </TarjetaGrafico>
    </>
  )
}

// ── Retención ─────────────────────────────────────────────────────────────

export function SeccionRetencion({ r }: { r: ReporteRetencion }) {
  const [tabla] = tablasRetencion(r)
  const meses = Math.max(0, ...r.cohortes.map((c) => c.retencion.length))
  return (
    <TarjetaGrafico
      titulo="Retención por cohorte"
      sub="De cada mes de alta, qué porcentaje participó en un viaje N meses después"
      tabla={tabla}
    >
      {r.cohortes.length ? (
        <MapaCalor
          filas={r.cohortes.map((c) => `${c.cohorte} (${c.tamano})`)}
          columnas={Array.from({ length: meses }, (_, k) => `M${k}`)}
          valor={(i, j) => r.cohortes[i].retencion[j] ?? null}
          max={1}
          formato={(v) => fmtNum(v * 100)}
          mostrarValores
          anchoCelda={36}
          anchoRotulo={84}
          describir={(i, j, v) =>
            v == null
              ? `Cohorte ${r.cohortes[i].cohorte}: el mes ${j} todavía no ocurrió.`
              : `Cohorte ${r.cohortes[i].cohorte}: ${fmtPct(v, 1)} participó en un viaje en el mes ${j} desde su alta.`
          }
        />
      ) : (
        <Nota>No hubo altas en los meses analizados.</Nota>
      )}
      <Nota>
        Las cuentas creadas antes de habilitar el backoffice tienen como fecha de alta la de esa migración: las
        cohortes anteriores no son representativas.
      </Nota>
    </TarjetaGrafico>
  )
}

// ── Viajes ────────────────────────────────────────────────────────────────

export function SeccionViajes({ r }: { r: ReporteViajes }) {
  const [serie, porActividad, porModo, tamano, , horarios] = tablasViajes(r)
  const maxHora = Math.max(0, ...r.horarios.map((h) => h.cantidad))
  const celdas = new Map(r.horarios.map((h) => [`${h.dia_semana}-${h.hora}`, h.cantidad]))
  return (
    <>
      <FilaIndicadores>
        <Indicador
          label="Tasa de realización"
          valor={fmtPct(r.embudo.tasa_realizacion)}
          pie={`${fmtNum(r.embudo.no_realizados)} viajes programados no arrancaron`}
        />
        <Indicador
          label="Grupales vs. individuales"
          valor={`${fmtNum(r.grupales_vs_individuales.grupales)} / ${fmtNum(r.grupales_vs_individuales.individuales)}`}
          pie="Viajes iniciados en el período"
        />
      </FilaIndicadores>
      <TarjetaGrafico titulo="Viajes en el tiempo" sub="Creados, iniciados y finalizados" tabla={serie}>
        <GraficoLineas
          datos={r.serie}
          granularidad={r.periodo.granularidad}
          series={[
            { clave: 'iniciados', label: 'Iniciados' },
            { clave: 'creados', label: 'Creados' },
            { clave: 'finalizados', label: 'Finalizados' },
          ]}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Por actividad" sub="Viajes iniciados, distancia y duración. Sin velocidades (RN-070)." tabla={porActividad}>
        <BarrasHorizontales
          items={r.por_actividad.map((f) => ({
            label: rotulo(f.actividad),
            valor: f.viajes,
            detalle: `${fmtNum(f.km_promedio, 1)} km · ${fmtNum(f.duracion_promedio_min)} min prom.`,
          }))}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Modo del viaje" tabla={porModo}>
        <BarrasHorizontales items={r.por_modo.map((f) => ({ label: rotulo(f.modo), valor: f.cantidad }))} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Tamaño de los viajes grupales" sub="Personas que participaron" tabla={tamano}>
        <BarrasHorizontales items={r.tamano_grupo.map((f) => ({ label: `${f.rango} personas`, valor: f.cantidad }))} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="¿Cuándo salen?" sub="Inicios por día y hora, en hora argentina" tabla={horarios}>
        <MapaCalor
          filas={DIAS_SEMANA}
          columnas={Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? String(h) : ''))}
          valor={(i, j) => celdas.get(`${i + 1}-${j}`) ?? 0}
          max={maxHora}
          describir={(i, j, v) => `${DIAS_SEMANA[i]} de ${j} a ${j + 1} h: ${fmtNum(v ?? 0)} viajes`}
        />
      </TarjetaGrafico>
    </>
  )
}

// ── Comunidad ─────────────────────────────────────────────────────────────

export function SeccionComunidad({ r }: { r: ReporteComunidad }) {
  const [serie, canales, tamano] = tablasComunidad(r)
  return (
    <>
      <FilaIndicadores>
        <Indicador label="Aceptación de invitaciones a viajes" valor={fmtPct(r.invitaciones_viaje.tasa_aceptacion)} />
        <Indicador label="Aceptación de invitaciones a grupos" valor={fmtPct(r.invitaciones_grupo.tasa_aceptacion)} />
        <Indicador
          label="Grupos activos"
          valor={fmtPct(r.grupos.tasa_actividad)}
          pie={`${fmtNum(r.grupos.activos_en_periodo)} de ${fmtNum(r.grupos.totales)} salieron en el período`}
        />
        <Indicador
          label="Amigos por usuario"
          valor={fmtNum(r.amistades.amigos_promedio_por_usuario, 1)}
          pie="Promedio de amistades aceptadas"
        />
      </FilaIndicadores>
      <TarjetaGrafico titulo="¿Cómo se suma la gente a los viajes?" sub="Canal de incorporación (sin contar al creador)" tabla={canales}>
        <BarrasHorizontales items={r.canales_incorporacion.map((f) => ({ label: rotulo(f.canal), valor: f.cantidad }))} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Crecimiento de la red" tabla={serie}>
        <GraficoLineas
          datos={r.serie}
          granularidad={r.periodo.granularidad}
          series={[
            { clave: 'amistades_nuevas', label: 'Amistades' },
            { clave: 'grupos_creados', label: 'Grupos' },
            { clave: 'rutas_compartidas', label: 'Rutas compartidas' },
          ]}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Tamaño de los grupos" sub={`Promedio: ${fmtNum(r.grupos.tamano_promedio, 1)} integrantes`} tabla={tamano}>
        <BarrasHorizontales items={r.grupos.distribucion_tamano.map((f) => ({ label: `${f.rango} integrantes`, valor: f.cantidad }))} />
      </TarjetaGrafico>
    </>
  )
}

// ── Seguridad ─────────────────────────────────────────────────────────────

export function SeccionSeguridad({ r }: { r: ReporteSeguridad }) {
  const [alertas, incidentes, , paradas] = tablasSeguridad(r)
  const porTipo = new Map<string, number>()
  for (const a of r.alertas.por_tipo_y_origen) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + a.cantidad)
  const min = r.solicitudes_parada.mediana_respuesta_seg
  return (
    <>
      <FilaIndicadores>
        <Indicador
          label="Incidentes cada 100 viajes"
          valor={fmtNum(r.incidentes.cada_100_viajes, 1)}
          pie={`${fmtNum(r.incidentes.detectados)} detectados por el motor`}
        />
        <Indicador
          label="Falsas alarmas"
          valor={fmtPct(r.incidentes.tasa_falsas_alarmas)}
          pie={`${fmtNum(r.incidentes.pidieron_ayuda)} pidieron ayuda · ${fmtNum(r.incidentes.sin_respuesta)} sin respuesta`}
        />
        <Indicador label="Alertas cada 100 viajes" valor={fmtNum(r.alertas.cada_100_viajes, 1)} />
        <Indicador
          label="Respuesta del líder"
          valor={min == null ? '—' : min < 120 ? `${fmtNum(min)} s` : `${fmtNum(min / 60, 1)} min`}
          pie={`Mediana · aprueba ${fmtPct(r.solicitudes_parada.tasa_aprobacion)} de las solicitudes de parada`}
        />
      </FilaIndicadores>
      <TarjetaGrafico
        titulo="Falsas alarmas por actividad"
        sub="Si una actividad tiene muchas, conviene subir su umbral de detección"
        tabla={incidentes}
      >
        <BarrasHorizontales
          max={1}
          formato={(v) => fmtPct(v)}
          items={r.incidentes.por_actividad.map((f) => ({
            label: rotulo(f.actividad),
            valor: f.tasa_falsas_alarmas ?? 0,
            detalle: `${fmtNum(f.detectados)} detectados`,
          }))}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Alertas por tipo" sub={`${fmtNum(r.alertas.total)} alertas en el período`} tabla={alertas}>
        <BarrasHorizontales
          items={[...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, valor]) => ({ label: rotulo(tipo), valor }))}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Paradas voluntarias" sub="Por categoría" tabla={paradas}>
        <BarrasHorizontales
          items={r.paradas_voluntarias.map((f) => ({
            label: rotulo(f.categoria),
            valor: f.cantidad,
            detalle: `${fmtNum(f.duracion_promedio_min)} min prom.`,
          }))}
        />
      </TarjetaGrafico>
    </>
  )
}

// ── Destinos ──────────────────────────────────────────────────────────────

export function SeccionDestinos({ r }: { r: ReporteDestinos }) {
  const [destinos, origenes, distancias, categorias] = tablasDestinos(r)
  const anonimato = `Solo lugares elegidos por al menos ${r.umbral_k_anonimato} personas distintas, para que nadie sea identificable.`
  return (
    <>
      <TarjetaGrafico titulo="Destinos más elegidos" sub={anonimato} tabla={destinos}>
        <BarrasHorizontales items={r.top_destinos.map((f) => ({ label: f.lugar, valor: f.viajes }))} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Puntos de partida más usados" tabla={origenes}>
        <BarrasHorizontales items={r.top_origenes.map((f) => ({ label: f.lugar, valor: f.viajes }))} />
      </TarjetaGrafico>
      <TarjetaGrafico
        titulo="Demanda de servicios en ruta"
        sub="Paradas que se planifican, por categoría: oportunidad de acuerdos comerciales"
        tabla={categorias}
      >
        <BarrasHorizontales items={r.paradas_planificadas_por_categoria.map((f) => ({ label: rotulo(f.categoria), valor: f.cantidad }))} />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Distancia planeada" tabla={distancias}>
        <BarrasHorizontales items={r.distancia_planeada.map((f) => ({ label: f.rango, valor: f.cantidad }))} />
      </TarjetaGrafico>
    </>
  )
}

// ── Adopción ──────────────────────────────────────────────────────────────

export function SeccionAdopcion({ r }: { r: ReporteAdopcion }) {
  return (
    <>
      <TarjetaGrafico
        titulo="Uso de funcionalidades"
        sub={`Porcentaje de los ${fmtNum(r.viajes_iniciados)} viajes iniciados que usó cada una`}
      >
        <BarrasHorizontales
          max={1}
          formato={(v) => fmtPct(v)}
          items={[...r.funcionalidades]
            .sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0))
            .map((f) => ({ label: rotulo(f.funcionalidad), valor: f.tasa ?? 0 }))}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Cuentas" sub={`Sobre ${fmtNum(r.usuarios.activos)} cuentas activas`}>
        <BarrasHorizontales
          max={1}
          formato={(v) => fmtPct(v)}
          items={r.usuarios.indicadores.map((f) => ({ label: rotulo(f.indicador), valor: f.tasa ?? 0 }))}
        />
      </TarjetaGrafico>
      <FilaIndicadores>
        <Indicador
          label="Viajes con la ubicación apagada"
          valor={fmtPct(r.privacidad.tasa_ubicacion_apagada)}
          pie={`${fmtNum(r.privacidad.con_ubicacion_apagada)} de ${fmtNum(r.privacidad.participaciones)} participaciones. Indicador de confianza.`}
        />
      </FilaIndicadores>
    </>
  )
}

// ── Gastos ────────────────────────────────────────────────────────────────

export function SeccionGastos({ r }: { r: ReporteGastos }) {
  const [serie, porActividad] = tablasGastos(r)
  return (
    <>
      <FilaIndicadores>
        <Indicador label="Monto total registrado" valor={pesos(r.resumen.monto_total)} />
        <Indicador label="Promedio por persona" valor={pesos(r.resumen.promedio_por_persona)} pie="En viajes con gastos" />
        <Indicador label="Promedio por viaje" valor={pesos(r.resumen.promedio_por_viaje)} />
        <Indicador
          label="Viajes que usan gastos"
          valor={fmtPct(r.resumen.tasa_uso)}
          pie={`${fmtNum(r.resumen.viajes_con_gastos)} de ${fmtNum(r.resumen.viajes_iniciados)}`}
        />
      </FilaIndicadores>
      <TarjetaGrafico titulo="Gasto en el tiempo" tabla={serie}>
        <GraficoLineas
          datos={r.serie}
          granularidad={r.periodo.granularidad}
          series={[{ clave: 'monto', label: 'Monto' }]}
          formato={(n) => (n >= 1_000_000 ? `${fmtNum(n / 1_000_000, 1)} M` : n >= 1000 ? `${fmtNum(n / 1000)} k` : fmtNum(n))}
        />
      </TarjetaGrafico>
      <TarjetaGrafico titulo="Gasto por persona según actividad" tabla={porActividad}>
        <BarrasHorizontales
          formato={pesos}
          items={r.por_actividad.map((f) => ({ label: rotulo(f.actividad), valor: f.promedio_por_persona ?? 0 }))}
        />
      </TarjetaGrafico>
      <Nota>Montos tal como los cargaron los usuarios: la app no registra moneda.</Nota>
    </>
  )
}

const styles = StyleSheet.create({
  nota: { fontSize: 12, lineHeight: 17 },
})
