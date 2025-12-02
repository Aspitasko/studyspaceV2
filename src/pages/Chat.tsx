import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, Trash2, MessageCircle, Lock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
  };
  user_id: string;
}

// Generate consistent color from username
const getAvatarColor = (username: string) => {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Format timestamp
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [chatLocked, setChatLocked] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Fetch chat_locked setting
  useEffect(() => {
    const fetchSettings = async () => {
      setSettingsLoading(true);
      const { data } = await (supabase as any).from('settings').select('chat_locked').single();
      setChatLocked(!!data?.chat_locked);
      setSettingsLoading(false);
    };
    fetchSettings();

    // Subscribe to realtime changes in settings
    const channel = supabase
      .channel('settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
        },
        (payload) => {
          const newLocked = payload.new?.chat_locked;
          setChatLocked(!!newLocked);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        profiles (username)
      `)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (chatLocked) {
      toast({
        title: 'Chat Locked',
        description: 'General chat is currently locked by an admin',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('chat_messages').insert({
      user_id: user?.id,
      content: newMessage.trim(),
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (id: string) => {
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-accent" />
            General Chat
          </h1>
          <p className="text-muted-foreground">Connect with your study community</p>
        </div>
        <div className="flex items-center gap-4">
          {chatLocked && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Lock className="h-4 w-4" />
              <span>Locked</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-background/50 backdrop-blur-sm border-border/50">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
            <div className="py-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No messages yet</p>
                  <p className="text-sm">Be the first to start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.user_id === user?.id;
                  const showAvatar = index === 0 || messages[index - 1].user_id !== message.user_id;
                  const isLastFromUser = index === messages.length - 1 || messages[index + 1].user_id !== message.user_id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 flex-shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(message.profiles.username)}`}>
                          {message.profiles.username.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-medium text-foreground">
                              {message.profiles.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`relative group/message ${isOwn ? 'flex flex-row-reverse items-center gap-2' : 'flex items-center gap-2'}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl break-words ${
                              isOwn
                                ? 'bg-accent text-accent-foreground rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                            } ${!showAvatar && isOwn ? 'rounded-tr-md' : ''} ${!showAvatar && !isOwn ? 'rounded-tl-md' : ''}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          
                          {/* Delete button */}
                          {isOwn && (
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="opacity-0 group-hover/message:opacity-100 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {!showAvatar && isLastFromUser && (
                          <span className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                            {formatTime(message.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border/50 p-4 bg-muted/30">
            {chatLocked && (
              <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-3 py-2 bg-destructive/10 rounded-lg">
                <Lock className="h-4 w-4" />
                <span>Chat is currently locked by an admin</span>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={chatLocked ? "Chat is locked..." : "Type a message..."}
                  className="bg-background/50 border-border/50 focus:border-accent transition-colors"
                  disabled={chatLocked || settingsLoading}
                />
              </div>
              <Button
                type="submit"
                size="icon"
                className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg transition-all hover:scale-105 h-10 w-10"
                disabled={chatLocked || settingsLoading || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Chat;
