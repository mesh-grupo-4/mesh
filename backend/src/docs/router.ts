import { Router } from 'express'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './index'
import { loginDocsHandler } from './login'

/**
 * Router de documentación interactiva.
 *
 * - `GET  /api/docs`       → Swagger UI
 * - `GET  /api/docs.json`  → spec OpenAPI crudo (para clientes, Postman o codegen)
 * - `POST /api/docs/login` → intercambia email + contraseña por un Firebase ID token
 */
export const docsRouter = Router()

/**
 * Swagger UI necesita estilos y un script inline que la Content-Security-Policy
 * por defecto de helmet bloquea. En vez de desactivar la CSP —lo que dejaría la
 * página sin ninguna protección—, se define una política propia y acotada a este
 * sub-router: mismo origen para todo, `unsafe-inline` únicamente donde la UI lo
 * exige, y `object-src 'none'`. El header se reescribe sobre el que puso el
 * helmet global de `src/app.ts`, sin alterarlo para el resto de la API.
 */
docsRouter.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
      },
    },
  })
)

docsRouter.get('/docs.json', (_req, res) => {
  res.json(openapiSpec)
})

// Antes del montaje de `/docs`: así el POST nunca cae en el serve-static de Swagger UI.
docsRouter.post('/docs/login', loginDocsHandler)

/**
 * Script auxiliar de la página, inyectado inline en el `<head>`.
 *
 * Define `window.meshDocsAuth`, que el `responseInterceptor` llama cuando el login
 * responde OK. Va acá y no en un archivo aparte porque `customJsStr` es la única vía
 * de swagger-ui-express para inyectar código sin servir un asset extra, y la CSP del
 * sub-router ya contempla `'unsafe-inline'` en `script-src`.
 */
const scriptSesion = `
window.meshDocsAuth = (function () {
  var CLAVE = 'mesh-docs-sesion';
  var ID_BANNER = 'mesh-sesion';

  function pintar(texto, color) {
    var caja = document.getElementById(ID_BANNER);
    if (!caja) {
      caja = document.createElement('div');
      caja.id = ID_BANNER;
      caja.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px 16px;' +
        'font:14px/1.4 system-ui,sans-serif;color:#fff;text-align:center';
      document.body.appendChild(caja);
      document.body.style.paddingTop = '34px';
    }
    caja.style.background = color;
    caja.textContent = texto;
  }

  function guardar(sesion) {
    try { localStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch (e) {}
  }
  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; }
  }
  function borrar() {
    try { localStorage.removeItem(CLAVE); } catch (e) {}
  }

  function autorizar(token) {
    var defs = window.ui.specSelectors.securityDefinitions();
    window.ui.authActions.authorize({
      BearerAuth: {
        name: 'BearerAuth',
        schema: defs ? defs.toJS().BearerAuth : { type: 'http', scheme: 'bearer' },
        value: token,
      },
    });
  }

  function anunciar(email, venceEn) {
    var minutos = Math.max(0, Math.round(venceEn / 60000));
    pintar(
      'Sesión iniciada como ' + email + ' — el token se aplica solo a cada request. ' +
        'Vence en ~' + minutos + ' min; volvé a ejecutar POST /api/docs/login para renovarlo.',
      '#1f7a3d'
    );
  }

  /**
   * Cuando el candado queda vacío —típicamente por *Authorize → Logout*— la sesión
   * guardada tiene que irse con él, o volvería sola en la próxima recarga.
   */
  function seguirLogout() {
    try {
      window.ui.getStore().subscribe(function () {
        var vacio = window.ui.authSelectors.authorized().size === 0;
        if (vacio && leer()) {
          borrar();
          pintar('Sesión cerrada. Ejecutá POST /api/docs/login para volver a entrar.', '#555');
        }
      });
    } catch (e) {}
  }

  /** Restaura la sesión guardada al abrir la página, si todavía no venció. */
  function restaurar() {
    var sesion = leer();
    if (!sesion || !sesion.token) return;
    var restante = sesion.expira - Date.now();
    if (restante <= 0) {
      borrar();
      pintar('La sesión anterior venció. Ejecutá POST /api/docs/login de nuevo.', '#8a6d1f');
      return;
    }
    autorizar(sesion.token);
    anunciar(sesion.email, restante);
  }

  // El script corre en el <head>: hay que esperar a que swagger-ui-init.js cree window.ui.
  var esperas = 0;
  var pid = setInterval(function () {
    if (window.ui && window.ui.authActions && document.body) {
      clearInterval(pid);
      restaurar();
      seguirLogout();
    } else if (++esperas > 100) {
      clearInterval(pid);
    }
  }, 100);

  return {
    /** Deja el ID token cargado en el candado; de ahí en más viaja en cada request. */
    aplicar: function (token, email, expiraEnSeg) {
      if (!window.ui || !token) return false;
      var venceEn = (expiraEnSeg || 3600) * 1000;
      autorizar(token);
      guardar({ token: token, email: email, expira: Date.now() + venceEn });
      anunciar(email, venceEn);
      return true;
    },
    error: function (mensaje) {
      pintar('No se pudo iniciar sesión: ' + mensaje, '#a32020');
    },
  };
})();
`

/**
 * `customJsStr` existe en swagger-ui-express desde la v4 —es lo que inyecta el script
 * inline en el `<head>`— pero `@types/swagger-ui-express` todavía no lo declara. El cast
 * se acota a este objeto en vez de castear el `setup()` entero, para no perder el chequeo
 * de tipos sobre el resto de las opciones.
 */
const opcionesUi = {
  customSiteTitle: 'Mesh API — Documentación',
  customJsStr: scriptSesion,
  swaggerOptions: {
    // Con 65 operaciones, expandir todo de entrada vuelve la página inmanejable:
    // se listan las operaciones plegadas y agrupadas por tag.
    docExpansion: 'list',
    defaultModelsExpandDepth: 1,
    // Swagger UI 5.32 no la respeta —probado: no escribe nada en localStorage—, así que
    // la sesión entre recargas la sostiene `meshDocsAuth`, que además conoce el
    // vencimiento del token y descarta el que ya expiró. Se deja declarada por si una
    // versión futura vuelve a implementarla.
    persistAuthorization: true,
    tryItOutEnabled: true,
    /**
     * Cierra el circuito del login: en cuanto `POST /api/docs/login` responde, el ID
     * token queda autorizado en la UI sin que nadie lo copie ni lo pegue.
     *
     * swagger-ui-express serializa esta función con `String(fn)` y la evalúa en el
     * navegador, así que no puede cerrar sobre nada del scope de Node. Por lo mismo
     * usa `globalThis` y no `window`: acá se compila con las libs de Node, donde
     * `window` no existe, pero en el navegador son el mismo objeto.
     */
    responseInterceptor: function (res: {
      url?: string
      ok?: boolean
      status?: number
      body?: unknown
    }) {
      try {
        const ruta = String(res.url || '').split('?')[0]
        if (!/\/api\/docs\/login$/.test(ruta)) return res

        const cuerpo = (
          typeof res.body === 'string' ? JSON.parse(res.body) : res.body
        ) as { idToken?: string; email?: string; expiresIn?: number; error?: string } | null

        const auth = (
          globalThis as unknown as {
            meshDocsAuth?: {
              aplicar: (token: string, email?: string, expiraEnSeg?: number) => boolean
              error: (mensaje: string) => void
            }
          }
        ).meshDocsAuth
        if (!auth) return res

        if (res.ok && cuerpo && cuerpo.idToken) {
          auth.aplicar(cuerpo.idToken, cuerpo.email, cuerpo.expiresIn)
        } else if (cuerpo && cuerpo.error) {
          auth.error(cuerpo.error)
        }
      } catch (e) {
        console.error('[mesh-docs] no se pudo aplicar el token del login', e)
      }
      return res
    },
  },
}

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, opcionesUi as unknown as swaggerUi.SwaggerUiOptions)
)
