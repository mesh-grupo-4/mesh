/**
 * Adopta el ciclo de vida por escenas (UIScene) en iOS.
 *
 * El SDK de iOS 27 aborta al lanzar las apps que no lo adoptan
 * (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`), y el template
 * nativo de Expo SDK 57 todavía no lo hace. Este plugin replica lo que trae el
 * template de SDK 58:
 *   - `Info.plist`: `UIApplicationSceneManifest` apuntando a `SceneDelegate`.
 *   - `AppDelegate.swift`: conforma `ExpoReactNativeFactoryProvider` y deja de crear
 *     la ventana (la crea `ExpoAppSceneDelegate`, que además arranca React Native).
 *   - Declara `SceneDelegate` en el mismo `AppDelegate.swift` (sin tocar el pbxproj).
 *
 * Es idempotente y no hace nada si el AppDelegate ya adoptó escenas, así que se
 * puede quitar sin riesgo al migrar a Expo SDK 58.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

const VENTANA_LEGACY =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/

const SCENE_DELEGATE = `
// Ciclo de vida por escenas, requerido por el SDK de iOS 27 (plugins/withIosSceneLifecycle.js).
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest ??= {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'SceneDelegate',
          },
        ],
      },
    }
    return cfg
  })
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle: se esperaba un AppDelegate en Swift.')
    }
    let src = cfg.modResults.contents
    if (src.includes('ExpoReactNativeFactoryProvider')) return cfg

    const conClase = src.replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    )
    const sinVentana = conClase.replace(
      VENTANA_LEGACY,
      '\n    // La ventana la crea SceneDelegate y ahí arranca React Native (iOS 27).\n',
    )
    if (conClase === src || sinVentana === conClase) {
      throw new Error(
        'withIosSceneLifecycle: el AppDelegate generado no tiene la forma esperada; revisar el plugin.',
      )
    }
    cfg.modResults.contents = sinVentana + SCENE_DELEGATE
    return cfg
  })
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config))
}
