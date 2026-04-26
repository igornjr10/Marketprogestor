import { z } from 'zod'

export const createClientSchema = z.object({
  name: z.string().min(2).max(100),
})

export type CreateClientDto = z.infer<typeof createClientSchema>
