import type { Credentials } from '@/api/greenApi.schemas'

export type Connection = Credentials & { sessionId: number }
