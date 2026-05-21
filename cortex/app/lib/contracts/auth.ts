import { z } from 'zod';

export const oauthProviderSchema = z.enum(['google', 'facebook']);

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(16),
});

export type OAuthProviderParam = z.infer<typeof oauthProviderSchema>;
