import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Send, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { ChatMessage } from '@/components/ChatMessage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RATE_LIMIT_MS = 3000;

const SYSTEM_PROMPT = `You are a helpful AI study assistant. You help students with:
- Explaining concepts clearly
- Answering questions about any subject
- Helping with homework and assignments
- Providing study tips and strategies
- Writing assistance and proofreading

Always be encouraging, patient, and thorough in your explanations. Use markdown formatting when helpful:
- Use **bold** for emphasis
- Use code blocks with language tags for code
- Use bullet points and numbered lists for clarity
- Use headers to organize long responses`;

const AIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSent, setLastSent] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [aiLocked, setAiLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const checkSettings = async () => {
      const { data: settings } = await supabase.from('settings').select('ai_locked').single() as any;
      if (settings) setAiLocked(settings.ai_locked);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single() as any;
      if (profile) setIsAdmin(profile.is_admin);
    };

    checkSettings();
  }, [user]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (aiLocked && !isAdmin) {
      toast({
        title: 'AI Locked',
        description: 'Only admins can use AI chat at this time.',
        variant: 'destructive',
      });
      return;
    }

    const now = Date.now();
    if (now - lastSent < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastSent)) / 1000);
      setCooldownSeconds(remainingSeconds);
      toast({
        title: 'Rate limit',
        description: `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before sending another message.`,
        variant: 'destructive',
      });
      return;
    }

    setLastSent(now);
    setCooldownSeconds(0);
    const userMessage = { role: 'user' as const, content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
            userMessage,
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed to get AI response');
      const data = await res.json();
      const aiMessage = data.choices?.[0]?.message?.content || 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to get AI response',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast({ title: 'Chat cleared' });
  };

  const regenerateLastResponse = async () => {
    if (messages.length < 2) return;
    
    // Remove last assistant message
    const newMessages = messages.slice(0, -1);
    const lastUserMessage = newMessages[newMessages.length - 1];
    
    if (lastUserMessage?.role !== 'user') return;
    
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages,
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed to get AI response');
      const data = await res.json();
      const aiMessage = data.choices?.[0]?.message?.content || 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to regenerate response',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Study Assistant</h1>
            <p className="text-sm text-muted-foreground">Powered by OpenAI models</p>
          </div>
        </div>
        <div className="flex gap-2">
          {messages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateLastResponse}
              disabled={loading}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Regenerate
            </Button>
          )}
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              disabled={loading}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              I'm your AI study assistant. Ask me anything about your studies, 
              homework, or any topic you'd like to learn about.
            </p>
            
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                'Explain quantum physics simply',
                'Help me with calculus',
                'Write a study schedule',
                'Summarize a topic',
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <ChatMessage role="assistant" content="" isLoading />
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <Card className="shadow-lg">
          <CardContent className="p-3">
            <form onSubmit={handleSend} className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={aiLocked && !isAdmin ? "AI chat is locked" : "Message AI Assistant... (Shift+Enter for new line)"}
                className="flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-sm min-h-[44px] max-h-[200px] py-3"
                rows={1}
                disabled={loading || (aiLocked && !isAdmin)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim() || cooldownSeconds > 0 || (aiLocked && !isAdmin)}
                className="flex-shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
              >
                {cooldownSeconds > 0 ? (
                  <span className="text-xs font-bold">{cooldownSeconds}</span>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              AI can make mistakes. Consider checking important information.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIChat;

