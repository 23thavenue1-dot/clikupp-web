
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, Sparkles, User, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { askChatbot } from '@/ai/flows/chatbot-flow';
import type { Message } from '@/ai/schemas/chatbot-schemas';
import { useUser } from '@/firebase';

export function Chatbot() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Comment puis-je vous aider aujourd'hui ?\n\nVous pouvez me demander, par exemple : \"Crée une galerie nommée 'Mes vacances'.\""
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
        const idToken = await user.getIdToken();
        const response = await askChatbot({
          history: newMessages,
          token: idToken,
        });

        if (response.content) {
            const assistantMessage: Message = { role: 'assistant', content: response.content };
            setMessages(prev => [...prev, assistantMessage]);
        }
    } catch (error) {
        console.error("Chatbot error:", error);
        const errorMessage: Message = {
            role: 'assistant',
            content: "Désolé, je rencontre une difficulté technique. Veuillez réessayer plus tard."
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!user) {
    return null; // N'affiche pas le chatbot si l'utilisateur n'est pas connecté
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white transform hover:scale-110 transition-transform"
          aria-label="Ouvrir l'assistant IA"
        >
          <Bot className="h-7 w-7" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="w-full sm:w-[440px] rounded-t-lg fixed bottom-0 right-0 sm:right-6 h-[70vh] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary"/>
            Assistant Clikup
          </SheetTitle>
          <SheetDescription>
            Posez une question ou demandez une action.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1" ref={scrollAreaRef as any}>
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={cn("flex items-start gap-3", message.role === 'user' && 'flex-row-reverse')}>
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>{message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                <div className={cn(
                    "p-3 rounded-lg max-w-[85%]",
                    message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="bg-muted p-3 rounded-lg rounded-bl-none">
                   <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="p-4 border-t bg-background">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
            <Textarea
              placeholder="Votre message..."
              rows={1}
              className="flex-1 resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
