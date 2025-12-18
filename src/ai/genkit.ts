
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { genAIApiKey } from '@/firebase/config';

export const ai = genkit({
  plugins: [googleAI({ apiKey: genAIApiKey })],
  model: 'googleai/gemini-2.5-flash',
});
