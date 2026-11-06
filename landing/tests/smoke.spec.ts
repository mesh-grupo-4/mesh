import { expect, test, type Page } from '@playwright/test'

const irA = async (page: Page, selector: string) => {
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }))
}

test('carga sin errores de consola y sin scroll horizontal', async ({ page }) => {
  const errores: string[] = []
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const alto = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < alto; y += 700) {
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y)
    await page.waitForTimeout(30)
  }
  expect(errores).toEqual([])
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw).toBeLessThanOrEqual(cw)
})

test('cada CTA existe y lleva a un destino', async ({ page }) => {
  await page.goto('/')
  for (const seccion of ['hero', 'nav', 'llegada']) {
    await expect(page.locator(`[data-cta="${seccion}"]`).first()).toHaveAttribute('href', /.+/)
  }
  await expect(page.locator('[data-cta="hero_probar"]')).toHaveAttribute('href', '#simulador')
  await expect(page.getByRole('button', { name: 'Próximamente en iPhone' })).toBeDisabled()
})

test('teclado: saltar al contenido y foco visible', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'movil', 'teclado físico: solo escritorio')
  void browserName
  await page.goto('/')
  await page.keyboard.press('Tab')
  const saltar = page.getByRole('link', { name: 'Saltar al contenido' })
  await expect(saltar).toBeFocused()
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).toBe('solid')
})

test('simulador completo: las cuatro situaciones, con avisos', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await irA(page, '[data-sim]')
  const contador = page.locator('[data-sim-contador]')
  const vivo = page.locator('[data-sim-vivo]')
  const salida = page.locator('[data-sim-salir]')
  await expect(contador).toHaveText('0/4')

  await page.getByRole('button', { name: 'Gonza agarra para cualquier lado' }).click()
  await expect(vivo).toContainText('Gonza se desvió de la ruta')
  await expect(vivo).toContainText('Le llega al líder')
  await expect(page.getByRole('button', { name: 'Gonza agarra para cualquier lado' })).toHaveAttribute('aria-pressed', 'true')
  await salida.click()
  await expect(contador).toHaveText('1/4')

  await page.getByRole('button', { name: 'Flor se queda atrás' }).click()
  await expect(vivo).toContainText('Flor quedó lejos del grupo')
  await salida.click()
  await expect(contador).toHaveText('2/4')

  await page.getByRole('button', { name: 'Nico para a cargar nafta' }).click()
  await expect(vivo).toContainText('Nico paró · Combustible')
  await expect(page.locator('[data-sim-salida]')).toContainText('Avisó, así que nadie se preocupa')
  await salida.click()
  await expect(contador).toHaveText('3/4')

  await page.getByRole('button', { name: 'Cami se queda quieta sin avisar' }).click()
  await expect(vivo).toContainText('Posible incidente · Cami')
  await expect(page.locator('[data-sim]')).toHaveAttribute('data-serio', '')
  await expect(page.locator('[data-sim] [data-aviso-seguridad]')).toContainText('911')
  await page.getByRole('button', { name: 'Estoy mal' }).click()
  await expect(page.locator('[data-sim-nota]')).toContainText('llamá al 911')
  await expect(contador).toHaveText('4/4')
  await expect(page.locator('[data-sim-meta]')).toBeVisible()
})

test('Estoy bien cancela el posible incidente', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await irA(page, '[data-sim]')
  await page.getByRole('button', { name: 'Cami se queda quieta sin avisar' }).click()
  await page.getByRole('button', { name: 'Estoy bien' }).click()
  await expect(page.locator('[data-sim-vivo]')).toContainText('aviso cancelado')
  await expect(page.locator('[data-sim]')).not.toHaveAttribute('data-serio', '')
})

test('cambio de actividad, con mouse y con flechas', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await irA(page, '[data-actividades]')
  const seccion = page.locator('[data-actividades]')
  await expect(page.locator('[data-act-panel="bici"]')).toBeVisible()
  await page.getByRole('radio', { name: 'Moto' }).click()
  await expect(seccion).toHaveAttribute('data-tema', 'moto')
  await expect(page.locator('[data-act-panel="moto"]')).toBeVisible()
  await expect(page.locator('[data-act-panel="bici"]')).toBeHidden()
  await expect(page.locator('[data-act-panel="moto"]')).toContainText('1.000 m')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Bici' })).toBeFocused()
  await expect(page.locator('[data-act-panel="bici"]')).toBeVisible()
})

test('el hash elige la actividad', async ({ page }) => {
  await page.goto('/#trekking', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-actividades]')).toHaveAttribute('data-tema', 'trekking')
  await expect(page.locator('[data-act-panel="trekking"]')).toBeVisible()
})

test('privacidad: el interruptor apaga la rueda y explica la consecuencia', async ({ page }) => {
  await page.goto('/')
  await irA(page, '[data-privacidad]')
  const sw = page.getByRole('switch', { name: 'Compartir mi ubicación' })
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('[data-priv-estado]')).toHaveText('El grupo no te ve.')
  await expect(page.locator('[data-priv-consecuencia]')).toContainText('Mesh no genera alertas sobre vos')
})

test('llegada: el CTA está antes de que termine la secuencia y cierra en 6/6', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await irA(page, '[data-llegada]')
  await expect(page.locator('[data-cta="llegada"]').first()).toBeVisible()
  await expect(page.locator('[data-lleg-contador]')).toHaveText('6/6', { timeout: 10000 })
  await expect(page.locator('[data-lleg-final]')).toBeVisible()
})

test('pausar animaciones persiste', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await irA(page, '[data-pausar]')
  await page.locator('[data-pausar]').click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
  await expect(page.locator('[data-pausar]')).toHaveText('Reanudar animaciones')
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
})

test('pausar en vivo: desarma los pines, deja todo legible, y se puede reanudar', async ({ page }, info) => {
  test.skip(info.project.name === 'movil', 'los pines son solo de escritorio')
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await expect(page.locator('.pin-spacer')).toHaveCount(2)
  await irA(page, '[data-pausar]')
  await page.locator('[data-pausar]').click()
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expect(page.locator('[data-lleg-contador]')).toHaveText('6/6')
  await expect(page.locator('.paso__texto').first()).toBeVisible()
  await expect(page.locator('[data-burbuja]').first()).toHaveCSS('opacity', '1')
  await page.locator('[data-pausar]').click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on')
  await expect(page.locator('.pin-spacer')).toHaveCount(2)
})

test('privacidad de la propia landing: sin cookies, sin terceros y sin pedir GPS', async ({ page, context, baseURL }) => {
  const ajenas: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) ajenas.push(r.url())
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await page.waitForTimeout(500)
  expect(ajenas).toEqual([])
  expect(await context.cookies()).toEqual([])
  const pideGps = await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state)
  expect(pideGps).toBe('prompt')
})

test('legales accesibles desde el footer, con banner de borrador', async ({ page }) => {
  await page.goto('/privacidad/')
  await expect(page.getByText('Borrador. Pendiente de revisión legal')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacidad')
  await page.goto('/terminos/')
  await expect(page.locator('[data-aviso-seguridad]').first()).toContainText('911')
})

test('una ruta inexistente responde 404 con salida a la landing', async ({ page }) => {
  const r = await page.goto('/no-existe')
  expect(r?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta ruta no existe.')
  await page.getByRole('link', { name: 'Volver a Mesh' }).click()
  await expect(page).toHaveURL('/')
})

test('texto no decorativo con 15 px como mínimo', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const chicos = await page.evaluate(() => {
    const salida: string[] = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const n = w.currentNode as Text
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || el.closest('svg, script, style, noscript')) continue
      const c = getComputedStyle(el)
      if (c.display !== 'none' && parseFloat(c.fontSize) < 15) salida.push(`${n.textContent.trim().slice(0, 30)} (${c.fontSize})`)
    }
    return salida
  })
  expect(chicos).toEqual([])
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('se ven el H1, los CTA y toda la historia', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/¿Y el Gonza\?/)
    await expect(page.locator('[data-cta="hero"]')).toBeVisible()
    await expect(page.locator('.paso__texto')).toHaveCount(4)
    await expect(page.locator('[data-act-panel="moto"]')).toBeVisible()
    await expect(page.locator('[data-act-panel="trekking"]')).toBeVisible()
    await expect(page.locator('[data-lleg-contador]')).toHaveText('6/6')
    await expect(page.locator('[data-sim-meta]')).toBeHidden()
    await expect(page.locator('.sim__leyenda')).toBeVisible()
  })
})

test.describe('con reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('sin pin ni Lenis, y el simulador sigue funcionando', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
    await expect(page.locator('.pin-spacer')).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveClass(/lenis/)
    await expect(page.locator('[data-cinta-trazo]')).toHaveAttribute('stroke-dashoffset', '0')
    await irA(page, '[data-sim]')
    await page.getByRole('button', { name: 'Flor se queda atrás' }).click()
    await expect(page.locator('[data-sim-vivo]')).toContainText('Flor quedó lejos del grupo')
    await expect(page.locator('[data-lleg-contador]')).toHaveText('6/6')
  })
})
