// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ChatbotInputSchema = z.object({
  userId: z.string().describe("The authenticated user's ID."),
  history: z.array(MessageSchema),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

export const ChatbotOutputSchema = z.object({
  content: z.string(),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;
