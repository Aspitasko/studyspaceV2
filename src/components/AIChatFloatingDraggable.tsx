import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { X, Send, Sparkles, Check, Copy, User, RotateCcw, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RATE_LIMIT_MS = 3000;

const SYSTEM_PROMPT = `You are a helpful AI study assistant. Be concise but thorough. Use markdown formatting:
- Use **bold** for emphasis
- Use code blocks with language tags for code
- Use bullet points for lists
Keep responses focused and helpful.`;

const GREETINGS = [
  'Hi there! I\'m your AI study buddy. How can I help you today?',
  'Welcome! Ask me anything about your studies.',
  'Hey! Ready to help you learn. What do you need?'
];

// Code block component with copy button
function FloatingCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-border/50 bg-muted/30 backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/50">
        <span className="text-[10px] text-muted-foreground font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-secondary text-secondary-foreground p-3 overflow-x-auto text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Message component
function FloatingMessage({ role, content, isLoading }: { role: 'user' | 'assistant'; content: string; isLoading?: boolean }) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-accent text-accent-foreground shadow-md'
      }`}>
        {isUser ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      </div>
      
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-muted/50 backdrop-blur-sm text-foreground rounded-bl-sm border border-border/50'
      }`}>
        {isLoading ? (
          <div className="flex items-center gap-1 py-1">
            <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-pre:p-0 prose-pre:bg-transparent">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');
                  const isInline = !codeString.includes('\n') && !match;

                  if (!isInline) {
                    return <FloatingCodeBlock language={language} code={codeString} />;
                  }

                  return (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0 text-sm">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-2 space-y-0.5 text-sm">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-2 space-y-0.5 text-sm">{children}</ol>;
                },
                li({ children }) {
                  return <li className="text-sm">{children}</li>;
                },
                strong({ children }) {
                  return <strong className="font-semibold">{children}</strong>;
                },
                a({ href, children }) {
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChatFloatingDraggable() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSent, setLastSent] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 40 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const size = expanded 
    ? { width: 500, height: 600 } 
    : { width: 380, height: 500 };

  useEffect(() => {
    if (open) setTimeout(() => scrollToBottom(), 100);
  }, [messages, open]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const now = Date.now();
    if (now - lastSent < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastSent)) / 1000);
      setCooldownSeconds(remainingSeconds);
      toast({
        title: 'Rate limit',
        description: `Please wait ${remainingSeconds}s`,
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
            ...messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0),
            userMessage,
          ],
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }]);
    toast({ title: 'Chat cleared' });
  };

  const regenerateLastResponse = async () => {
    if (messages.length < 2) return;
    
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
            ...newMessages.filter(m => m.role !== 'assistant' || newMessages.indexOf(m) > 0),
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const aiMessage = data.choices?.[0]?.message?.content || 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to regenerate', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Drag logic
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.body.style.userSelect = 'none';
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - size.width)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - size.height)),
    });
  };
  const onMouseUp = () => {
    setDragging(false);
    document.body.style.userSelect = '';
  };
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="fixed top-6 right-6 z-40 rounded-full shadow-xl bg-accent hover:bg-accent/90 text-accent-foreground border-0 transition-all duration-300 hover:scale-110"
        aria-label="Open AI Assistant"
        onClick={() => setOpen(true)}
        style={{ display: open ? 'none' : 'inline-flex' }}
      >
        <Sparkles className="w-5 h-5" />
      </Button>
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: size.width,
            height: size.height,
            maxWidth: 'calc(100vw - 20px)',
            transition: dragging ? 'none' : 'width 0.2s, height 0.2s',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-move select-none border-b border-border/50 flex-shrink-0 bg-muted/30 backdrop-blur-sm"
            onMouseDown={onMouseDown}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <span className="font-semibold text-foreground text-sm">AI Study Assistant</span>
                <p className="text-[10px] text-muted-foreground">Running OpenAI models</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={regenerateLastResponse}
                    disabled={loading}
                    className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Regenerate"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={clearChat}
                    disabled={loading}
                    className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Clear chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setExpanded(!expanded)}
                className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
                title={expanded ? "Minimize" : "Expand"}
              >
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setOpen(false)} 
                className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
            {messages.map((msg, i) => (
              <FloatingMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <FloatingMessage role="assistant" content="" isLoading />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/50 p-3 flex-shrink-0 bg-muted/30 backdrop-blur-sm">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Shift+Enter for new line)"
                className="flex-1 bg-background/50 border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2 resize-none max-h-24 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm backdrop-blur-sm"
                rows={1}
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim() || cooldownSeconds > 0}
                className="flex-shrink-0 h-9 w-9 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground border-0 transition-all shadow-lg hover:scale-105"
                title={cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send'}
              >
                {cooldownSeconds > 0 ? (
                  <span className="text-xs font-bold">{cooldownSeconds}</span>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              AI can make mistakes. Verify important info.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
