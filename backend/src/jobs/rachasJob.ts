import { prisma } from '../config/prisma'
import { RachasService } from '../modules/rachas/rachas.service'

const UN_DIA_MS = 24 * 60 * 60 * 1000
// Primer chequeo a los 5 min de levantar el server: da tiempo a que todo
// termine de inicializar sin competir con el arranque, y no hace falta que
// coincida con una hora exacta — el job es idempotente, corre tarde no rompe nada.
const PRIMER_CHEQUEO_MS = 5 * 60 * 1000

/**
 * RN-075: job diario que detecta rachas rotas por pura inactividad (nadie
 * finalizó un viaje en más de una semana) y manda el push el mismo día, en vez
 * de esperar a que la persona vuelva a salir. No es la fuente de verdad de la
 * racha —eso lo calcula `RachasService.obtenerRachaVigente()` en cada lectura—
 * así que si este job no corre un día, el perfil igual muestra el número
 * correcto; solo se atrasa la notificación.
 *
 * Proceso único, sin cola ni lock distribuido: alcanza para la escala de este
 * proyecto (RN-033: cientos de usuarios, no miles). Si en el futuro corren
 * varias instancias del server, hay que mover esto a un único worker.
 */
export function iniciarJobRachas(): void {
  const service = new RachasService(prisma)

  const correr = async () => {
    try {
      const rotas = await service.verificarRachasRotas()
      if (rotas > 0) {
        console.log(`[rachas] Job diario: ${rotas} racha(s) rota(s) notificada(s).`)
      }
    } catch (e) {
      console.error('[rachas] Job diario falló:', e)
    }
  }

  setTimeout(() => {
    void correr()
    setInterval(() => void correr(), UN_DIA_MS)
  }, PRIMER_CHEQUEO_MS)
}
