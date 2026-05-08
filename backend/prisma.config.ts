import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config()

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DIRECT_URL!
  }
})
