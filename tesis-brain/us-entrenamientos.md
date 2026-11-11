# US — Entrenamientos como serie (tab Entrenar, circuitos y Repetir)

> **Epic:** **E06** — Cierre, métricas y estadísticas / **E07** — Ghost tracking.
> **OpenAPI:** `backend/openapi/paths/entrenamientos.yaml` (`/api/entrenamientos/*`) y `POST /api/viajes` (`repetir`) en `backend/openapi/paths/viajes.yaml`.
> **RN:** RN-066 (nueva), RN-065 (modo entrenamiento), RN-070 (sin motorizados), RN-073 (fantasma).
> Relacionado: [[reglas-de-negocio]], [[us-viaje-ya]], [[us-ranking-viaje]]

---

## Descripción

**Como** persona que entrena en bici, corriendo o caminando
**quiero** un lugar donde arrancar un entrenamiento, ver mis sesiones y repetir un recorrido
**para** compararme contra mí mismo en el mismo circuito, sin tener que buscar un viaje viejo.

## Problema que resuelve

El modo entrenamiento (RN-065) ya calculaba la evolución entre sesiones, pero solo se veía entrando a un viaje terminado. No había dónde seguir los entrenamientos ni forma de armar uno nuevo sobre el mismo recorrido: el modo estaba al final del wizard y las sesiones se agrupaban solo por actividad.

## Conceptos

- **Sesión:** un viaje `finalizado` en modo `entrenamiento`, no motorizado, donde la persona tiene métricas (`metrica_viaje`). Cuenta aunque el viaje lo haya armado otra persona.
- **Circuito:** las sesiones de una persona sobre un mismo recorrido. **Cada persona tiene los suyos**, con su propio nombre. Se arma solo, de dos maneras:
  1. **Repetir** una sesión: la original y la nueva quedan en el mismo circuito.
  2. Salir varias veces en modo entrenamiento desde la misma **ruta guardada** (`rutaPlantillaId`).
- **Repetir:** crear un entrenamiento nuevo a partir de una sesión, eligiendo qué recorrido usar:
  - **Lo planificado:** la ruta que se había armado para esa sesión, con sus paradas. Solo si la sesión tenía ruta.
  - **Lo que hice:** la traza GPS que recorrió quien repite, simplificada por PostGIS. Solo si tiene traza.

## Flujo

1. **Tab Entrenar** (`app/(tabs)/entrenar.tsx`), entre Viajes y Grupos. Arriba, **Nuevo entrenamiento**; debajo, dos pestañas y un filtro por actividad (running, bici, trekking, otro):
   - **Circuitos:** tarjeta por circuito con cantidad de sesiones, mejor ritmo, última sesión y barras de las últimas 6. Se puede renombrar y **Repetir** (repite la sesión más reciente). Tocar la tarjeta abre sus sesiones.
   - **Sesiones:** todas, de la más nueva a la más vieja, con distancia, ritmo y tiempo. Cada una tiene **Repetir** y, si está en un circuito, **Sacar**. Tocar la fila abre sus métricas.
2. **Nuevo entrenamiento** abre el selector de siempre (`app/nuevo-viaje.tsx`) con `modo=entrenamiento`: **Salir ahora** (Viaje YA) o **Planificar** (wizard). Moto y auto no se ofrecen. En el wizard arranca **individual**; se puede pasar a grupal e invitar.
3. **Repetir** (`app/repetir-entrenamiento.tsx`) está en la tab, en la pantalla de métricas y en el detalle del viaje finalizado:
   - Pregunta **Lo planificado / Lo que hice**. Si la sesión solo tiene uno de los dos, no pregunta.
   - Después, **Salir ahora / Planificar**. No se elige actividad ni recorrido: ya vienen de la sesión.
4. En el mapa en vivo del viaje repetido, **el fantasma de la sesión original se carga solo** para quien repitió (su propia traza de esa vez, RN-073). Se puede pausar o quitar; si se quita, no vuelve a aparecer. Los invitados eligen fantasma a mano, como siempre.

## Reglas

- **RN-070:** el modo entrenamiento no existe en moto ni auto. `POST /api/viajes` responde `400 MODO_INVALIDO`, la tab no los lista y los selectores de modo lo bloquean. Compuerta única: `esMotorizado()`.
- Solo se repite una sesión propia: sin métricas en ese viaje responde `404 SESION_NOT_FOUND`. Nunca se lee la traza de otra persona.
- Un viaje con `repetir` nace en `entrenamiento` y con la actividad de la sesión, sin importar lo que mande el cliente. No se combina con `rutaPlantillaId`.
- Una sesión está como mucho en un circuito por persona. Sacarla no borra el viaje ni sus métricas; un circuito sin sesiones se elimina.
- Los circuitos que todavía no tienen sesiones finalizadas no se muestran.
- En un entrenamiento grupal, el circuito se le arma solo a quien lo creó. A un invitado se le arma cuando repite él.

## Datos

- `circuito_entrenamiento` (id, usuario_id, nombre, tipo_actividad, ruta_plantilla_id).
- `circuito_sesion` (usuario_id, viaje_id, circuito_id), PK (usuario_id, viaje_id).
- `viaje.repite_viaje_id`: de qué sesión sale la repetición; de ahí sale el fantasma automático.
- Migración `20261111180000_circuitos_entrenamiento`, que además pasa a `recreativo` los viajes viejos de moto/auto en modo entrenamiento.

## Criterios de aceptación

- [ ] La tab Entrenar muestra mis circuitos y mis sesiones, filtrables por actividad.
- [ ] "Nuevo entrenamiento" crea un viaje en modo entrenamiento, saliendo ahora o planificado.
- [ ] No se puede crear un entrenamiento en moto ni auto, ni desde la app ni por API.
- [ ] Repetir una sesión crea un viaje con el recorrido elegido y lo suma al circuito.
- [ ] Al iniciar un viaje repetido, mi fantasma de la sesión original aparece sin elegirlo.
- [ ] Puedo renombrar un circuito y sacarle una sesión.
- [ ] Dos entrenamientos desde la misma ruta guardada quedan en el mismo circuito.
