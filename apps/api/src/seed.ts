import { Prisma, PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { canonicalJson, sha256 } from './crypto'
import { merchantKYC, motorAU } from './fixtures'
import './config'

const localEmail = 'admin@rulekit.test'
const localPassword = 'rulekit-local'
const localKey = 'rk_live_rulekit_demo_motor_au'

async function run(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL || localEmail).trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD || localPassword
  const key = process.env.SEED_API_KEY || localKey
  if (process.env.NODE_ENV === 'production' && (
    email === localEmail || password === localPassword || key === localKey
    || Buffer.byteLength(password) < 12 || key.length < 32
  )) {
    throw new Error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_API_KEY before production seeding')
  }
  if (Buffer.byteLength(password) > 72 || !/^rk_live_[A-Za-z0-9_-]{12,120}$/.test(key)) {
    throw new Error('Invalid seed password or API key')
  }
  const db = new PrismaClient()
  try {
    const passwordHash = await hash(password, 12)
    await db.$transaction(async (tx) => {
      const workspace = await tx.workspace.upsert({
        where: { id: 'rulekit-demo' },
        create: { id: 'rulekit-demo', name: 'Rulekit Sample Workspace' },
        update: {},
      })
      const user = await tx.user.upsert({
        where: { email },
        create: { email, passwordHash },
        update: {},
      })
      await tx.membership.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
        create: { userId: user.id, workspaceId: workspace.id, role: 'admin' },
        update: {},
      })
      const keyHash = sha256(key)
      await tx.apiKey.upsert({
        where: { hash: keyHash },
        create: { hash: keyHash, workspaceId: workspace.id, prefix: key.slice(0, 16), name: 'Local integration' },
        update: {},
      })
      for (const [slug, name, ruleset] of [
        ['motor-au', 'Motor Underwriting AU', motorAU],
        ['merchant-kyc', 'Merchant KYC Screening', merchantKYC],
      ] as const) {
        const json = ruleset as unknown as Prisma.InputJsonObject
        const project = await tx.project.upsert({
          where: { workspaceId_slug: { workspaceId: workspace.id, slug } },
          create: { workspaceId: workspace.id, slug, name, draft: { create: { ruleset: json } } },
          update: {},
        })
        if (project.activeVersionId) continue
        const version = await tx.rulesetVersion.create({
          data: {
            projectId: project.id, number: 1, ruleset: json,
            checksum: sha256(canonicalJson(ruleset)), note: 'Initial policy table',
          },
        })
        await tx.project.update({ where: { id: project.id }, data: { activeVersionId: version.id } })
      }
    })
  } finally {
    await db.$disconnect()
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
