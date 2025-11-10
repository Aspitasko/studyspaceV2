import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle } from 'lucide-react';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function AIChatFloating() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [welcome, setWelcome] = useState(true);

  useEffect(() => {
    if (open) setTimeout(() => setWelcome(false), 2000);
  }, [open]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
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
          messages: [...messages, userMessage],
        }),
      });
      if (!res.ok) throw new Error('Failed to get AI response');
      const data = await res.json();
      const aiMessage = data.choices?.[0]?.message?.content || 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
      setTimeout(scrollToBottom, 100);
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="fixed top-4 right-4 z-50 shadow-lg"
          aria-label="Open AI Assistant"
          onClick={() => setWelcome(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-md min-w-[320px] flex flex-col h-[80vh] resize-x overflow-hidden"
        style={{ resize: 'both', minHeight: 400 }}
      >
        <SheetHeader>
          <SheetTitle>AI Assistant</SheetTitle>
        </SheetHeader>
        <Card className="flex-1 flex flex-col shadow-none border-none bg-transparent min-h-0">
          <CardContent className="flex-1 flex flex-col min-h-0 px-0">
            <div className="flex-1 min-h-0 max-h-[60vh] overflow-y-auto space-y-4 mb-2 pb-2">
              {welcome && (
                <div className="flex justify-center">
                  <div className="bg-muted text-muted-foreground rounded-lg p-4 text-center text-base font-medium shadow">
                    Welcome! This is StudySpaceV2 AI Assistant.
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-card border border-border'
                    }`}
                  >
                    <p className="font-semibold text-sm mb-1">{msg.role === 'user' ? 'You' : 'AI'}</p>
                    <div className="text-sm whitespace-pre-line markdown-body">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="flex gap-2 pt-2 pb-1 bg-background sticky bottom-0 z-10">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1"
                disabled={loading}
                style={{ minHeight: 40 }}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} style={{ minWidth: 44, minHeight: 44, padding: 0 }}>
                {loading ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <span>→</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </SheetContent>
    </Sheet>
  );
}
