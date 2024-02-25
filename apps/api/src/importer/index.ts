import { analyzeRuleset, rulesetSchema } from '@rulekit/engine'
import { Prisma, PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { member } from '../auth'
import { HttpError } from '../errors'
import { extractWithModel } from './model'
import { extractRows, fixtureText } from './offline'
import { extractPDF } from './pdf'

const pdfLimit = 5 * 1024 * 1024
const textLimit = 48000
const importBody = z.object({
  pdfBase64: z.string().min(4).max(Math.ceil(pdfLimit / 3) * 4).regex(/^[a-zA-Z0-9+/]+={0,2}$/).optional(),
  text: z.string().trim().min(1).max(textLimit).optional(),
  fixture: z.boolean().default(false),
  preview: z.boolean().default(false),
}).refine((body) => Number(Boolean(body.pdfBase64)) + Number(Boolean(body.text)) + Number(body.fixture) === 1,
  'Provide a PDF, text table, or fixture')

export function importRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.post<{ Params: { id: string } }>('/v1/projects/:id/import-pdf', {
    bodyLimit: Math.ceil(pdfLimit / 3) * 4 + 1024,
  }, async (request) => {
    const { workspaceId } = await member(db, request, 'editor')
    const project = await db.project.findFirst({
      where: { id: request.params.id, workspaceId }, select: { id: true },
    })
    if (!project) throw new HttpError(404, 'Project not found')
    const body = importBody.parse(request.body)
    let text = body.text || fixtureText
    if (body.pdfBase64) {
      const buffer = Buffer.from(body.pdfBase64, 'base64')
      if (buffer.length > pdfLimit) throw new HttpError(413, 'PDF must be 5 MiB or smaller')
      if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new HttpError(400, 'Expected a PDF file')
      try {
        text = await extractPDF(buffer)
      } catch {
        throw new HttpError(422, 'Could not read PDF text')
      }
    }
    const sourceText = text.trim().slice(0, textLimit)
    const model = body.fixture ? undefined : await extractWithModel(sourceText).catch((error: unknown) => {
      request.log.warn({ type: error instanceof Error ? error.name : 'unknown' }, 'model extraction failed')
      return undefined
    })
    const ruleset = rulesetSchema.parse(model?.rules.length ? model : extractRows(sourceText))
    if (!ruleset.rules.length) throw new HttpError(422, 'No decision rules extracted. Try a field, operator, value and outcome table.')
    const issues = analyzeRuleset(ruleset)
    if (!body.preview) {
      const json = ruleset as unknown as Prisma.InputJsonObject
      await db.draft.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ruleset: json, sourceText },
        update: { ruleset: json, sourceText },
      })
    }
    return { ruleset, sourceText, issues }
  })
}
