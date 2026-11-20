import { createAtlasReader, serviceName } from './catalog.mjs'

export const runtime = {
  apply(ctx) {
    ctx.services.register({
      name: serviceName,
      scope: 'profile',
      kind: 'query',
      inputSchema: {
        type: 'object',
        properties: {
          selected: { type: 'string', maxLength: 48 },
          query: { type: 'string', maxLength: 120 },
          includeGraph: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          status: { enum: ['ready', 'missing', 'invalid'] },
          name: { type: 'string' },
          index: { type: 'object' },
          counts: { type: 'object' },
          detail: { type: 'object' },
          results: { type: 'array' },
          total: { type: 'integer' },
          neighbors: { type: 'array' },
        },
        required: ['status'],
        additionalProperties: false,
      },
      timeoutMs: 8000,
      maxResultBytes: 1048576,
      handler: createAtlasReader(),
    })
  },
}
