import i18n from '@/i18n'
import { z } from 'zod'

export const credentialsSchema = z.object({
  apiUrl: z
    .string({ error: () => i18n.t('validation.apiUrl') })
    .trim()
    .url({ error: () => i18n.t('validation.apiUrl') })
    .refine(
      (value) => {
        const url = new URL(value)

        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        )
      },
      { error: () => i18n.t('validation.apiUrl') },
    )
    .transform((value) => value.replace(/\/+$/, '')),

  idInstance: z
    .string({ error: () => i18n.t('validation.instanceId') })
    .trim()
    .regex(/^\d+$/, { error: () => i18n.t('validation.instanceId') }),

  apiTokenInstance: z
    .string({ error: () => i18n.t('validation.apiToken') })
    .trim()
    .min(1, { error: () => i18n.t('validation.apiToken') }),
})

export type Credentials = z.infer<typeof credentialsSchema>

export const messageSchema = z
  .string({ error: () => i18n.t('validation.messageRequired') })
  .trim()
  .min(1, { error: () => i18n.t('validation.messageRequired') })
  .max(4000, { error: () => i18n.t('validation.messageTooLong') })

export const stateSchema = z.object({
  stateInstance: z.enum([
    'authorized',
    'starting',
    'notAuthorized',
    'blocked',
    'suspended',
    'pendingPassword',
  ]),
})

export type InstanceState = z.infer<typeof stateSchema>['stateInstance']

export const settingsSchema = z.object({
  webhookUrl: z.string(),
  incomingWebhook: z.enum(['yes', 'no']),
})

export type InstanceSettings = z.infer<typeof settingsSchema>

export const accountSchema = z.union([
  z.object({ exist: z.boolean(), chatId: z.string() }),
  z.object({ status: z.literal(false), reason: z.string() }),
])

export const sentSchema = z.object({ idMessage: z.string().min(1) })

export const notificationSchema = z.object({
  receiptId: z.number().int(),
  body: z.unknown(),
})

export type ApiNotification = z.infer<typeof notificationSchema>

export const deletedSchema = z.object({ result: z.boolean() })

export const savedSettingsSchema = z.object({ saveSettings: z.boolean() })

export const incomingTextSchema = z.object({
  typeWebhook: z.literal('incomingMessageReceived'),
  idMessage: z.string().min(1),
  timestamp: z.number(),
  senderData: z.object({
    chatId: z.string().min(1),
    senderPhoneNumber: z.number().optional(),
  }),
  messageData: z.object({
    typeMessage: z.literal('textMessage'),
    textMessageData: z.object({ textMessage: z.string() }),
  }),
})

export type IncomingText = {
  chatId: string
  phoneNumber?: string
  idMessage: string
  text: string
  timestamp: number
}
