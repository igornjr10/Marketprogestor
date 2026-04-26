import { z } from 'zod'

export const finalizeMetaSchema = z.object({
  businessId: z.string().min(1),
  businessName: z.string().min(1),
  adAccountIds: z.array(z.string()).min(1),
  tokenData: z.string().min(1),
})

export type FinalizeMetaDto = z.infer<typeof finalizeMetaSchema>
