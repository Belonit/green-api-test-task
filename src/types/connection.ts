import type { Credentials } from '@/api/greenApi.schemas'

export type Connection = Credentials & { sessionId: number }

export type ConnectionStatus = 'connected' | 'retrying' | 'error'
