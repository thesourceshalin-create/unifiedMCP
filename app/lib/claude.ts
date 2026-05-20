import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in the environment')
    client = new Anthropic({ apiKey })
  }
  return client
}

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_sheets',
    description: 'List all sheets or tables available in the connected data source.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_sheet',
    description: 'Read all rows from a sheet or table.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'The sheet or table name to read.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'query_range',
    description: 'Read rows from a sheet with optional column filters and row limit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
        filters: {
          type: 'array',
          description: 'Optional filters to apply.',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: {
                type: 'string',
                enum: ['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains'],
              },
              value: { type: ['string', 'number', 'boolean'] },
            },
            required: ['column', 'operator', 'value'],
          },
        },
        limit: { type: 'number', description: 'Max rows to return.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'summarize_sheet',
    description: 'Get column schema and statistics (types, null counts, sample values) for a sheet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'find_duplicates',
    description: 'Find duplicate rows in a sheet, optionally limited to specific columns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to use for duplicate detection. Defaults to all columns.',
        },
      },
      required: ['sheet'],
    },
  },
]
