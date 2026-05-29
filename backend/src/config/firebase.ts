import admin from 'firebase-admin'
import type { Auth } from 'firebase-admin/auth'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // La clave privada viene con \n literales desde las vars de entorno
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export const firebaseAuth: Auth = admin.auth()
