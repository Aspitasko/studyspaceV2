import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

export function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`py-6 ${isUser ? 'bg-transparent' : 'bg-secondary/30'}`}>
      <div className="max-w-3xl mx-auto px-4 flex gap-4">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
        }`}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">
            {isUser ? 'You' : 'AI Assistant'}
          </div>
          
          {isLoading ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                components={{
                  // Code blocks with syntax highlighting
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    const isInline = !codeString.includes('\n') && !match;

                    if (!isInline) {
                      return (
                        <CodeBlock language={language} code={codeString} />
                      );
                    }

                    return (
                      <code
                        className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  // Paragraphs
                  p({ children }) {
                    return <p className="mb-3 last:mb-0">{children}</p>;
                  },
                  // Lists
                  ul({ children }) {
                    return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
                  },
                  li({ children }) {
                    return <li className="text-sm">{children}</li>;
                  },
                  // Headings
                  h1({ children }) {
                    return <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>;
                  },
                  // Links
                  a({ href, children }) {
                    return (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {children}
                      </a>
                    );
                  },
                  // Blockquotes
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-4 border-primary pl-4 italic my-3 text-muted-foreground">
                        {children}
                      </blockquote>
                    );
                  },
                  // Tables
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full border border-border rounded-lg overflow-hidden">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  thead({ children }) {
                    return <thead className="bg-secondary">{children}</thead>;
                  },
                  th({ children }) {
                    return <th className="px-3 py-2 text-left text-sm font-semibold border-b border-border">{children}</th>;
                  },
                  td({ children }) {
                    return <td className="px-3 py-2 text-sm border-b border-border">{children}</td>;
                  },
                  // Horizontal rule
                  hr() {
                    return <hr className="my-4 border-border" />;
                  },
                  // Strong and emphasis
                  strong({ children }) {
                    return <strong className="font-semibold">{children}</strong>;
                  },
                  em({ children }) {
                    return <em className="italic">{children}</em>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Code block component with copy button
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/80 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      {/* Code */}
      <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default ChatMessage;
