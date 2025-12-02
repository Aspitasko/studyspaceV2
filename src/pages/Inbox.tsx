// src/pages/Inbox.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquare,
  UserPlus,
  Users,
  Search,
  Send,
  Trash2,
  Check,
  X,
  Mail,
  ArrowLeft,
  Smile,
  Heart,
  ThumbsUp,
  Sparkles,
  Clock,
  TrendingUp,
  MessageCircle,
  UserCheck,
  Bell,
  MoreHorizontal,
  Reply,
  Forward,
  Copy,
  Star,
  Archive,
  Inbox as InboxIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

// Types
interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
  reactions?: string[];
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  last_seen?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const messageVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 50, transition: { duration: 0.2 } },
};

// Helper to format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Quick reaction emojis
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// Avatar component with online indicator
const UserAvatar = ({ username, isOnline, size = 'md' }: { username: string; isOnline?: boolean; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  
  const indicatorSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const colors = [
    'from-blue-500 to-purple-600',
    'from-green-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
    'from-yellow-500 to-orange-600',
  ];
  
  const colorIndex = username.charCodeAt(0) % colors.length;
  
  return (
    <div className="relative">
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center font-semibold text-white shadow-lg`}>
        {username.charAt(0).toUpperCase()}
      </div>
      {isOnline !== undefined && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${indicatorSizes[size]} rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'} border-2 border-background`} />
      )}
    </div>
  );
};

// Main Component
export default function Inbox() {
  const navigate = useNavigate();

  // user + data
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // UI state
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [activeTab, setActiveTab] = useState<'discover' | 'pending' | 'friends' | 'messages'>('messages');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set());

  // dialogs
  const [confirmDialog, setConfirmDialog] = useState<null | { title: string; description: string; onConfirm: () => void }>(null);

  // loading
  const [loading, setLoading] = useState(true);

  // autoscroll ref for chat area
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auth: get current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          navigate('/auth');
          return;
        }
        if (mounted) setUser(authUser);
      } catch (err) {
        console.error('Failed to get user', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Fetch helpers (memoized)
  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('fetchMessages error', error);
      return;
    }
    setMessages(data || []);
  }, [user?.id]);

  const fetchFriendRequests = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchFriendRequests error', error);
      return;
    }
    setFriendRequests((data as Friendship[]) || []);
  }, [user?.id]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) return;

    const { data: sentRequests, error: sentError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    const { data: receivedRequests, error: receivedError } = await supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_id', user.id)
      .eq('status', 'accepted');

    if (sentError || receivedError) {
      console.error('fetchFriends errors', sentError || receivedError);
      return;
    }

    const friendIds = [
      ...(sentRequests?.map((r: any) => r.friend_id) || []),
      ...(receivedRequests?.map((r: any) => r.user_id) || []),
    ];

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    const { data: friendProfiles, error } = await supabase.from('profiles').select('id, username').in('id', friendIds);
    if (error) {
      console.error('fetch friendProfiles error', error);
      return;
    }
    setFriends(friendProfiles || []);
  }, [user?.id]);

  const fetchAllUsers = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .neq('id', user.id)
      .order('username', { ascending: true })
      .limit(500);

    if (error) {
      console.error('fetchAllUsers error', error);
      return;
    }
    setAllUsers(data || []);
  }, [user?.id]);

  const fetchChatMessages = useCallback(
    async (friendId: string) => {
      if (!user?.id) return;
      const query = supabase
        .from('direct_messages')
        .select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(500);

      const { data, error } = await query;
      if (error) {
        console.error('fetchChatMessages error', error);
        return;
      }
      setChatMessages(data || []);
    },
    [user?.id]
  );

  // Actions
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedFriend || !user?.id) return;
    const payload = {
      from_user_id: user.id,
      to_user_id: selectedFriend.id,
      content: newMessage.trim(),
    };
    setNewMessage('');
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    };
    setChatMessages((s) => [...s, optimistic]);

    const { data, error } = await supabase.from('direct_messages').insert([payload]).select().single();
    if (error) {
      console.error('send message error', error);
      setChatMessages((s) => s.filter((m) => m.id !== optimistic.id));
      return;
    }

    setChatMessages((s) => {
      const replaced = s.map((m) => (m.id === optimistic.id ? data : m));
      if (!replaced.some((m) => m.id === data.id)) replaced.push(data);
      return replaced;
    });

    fetchMessages();
  }, [newMessage, selectedFriend, user?.id, fetchMessages]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setConfirmDialog({
      title: 'Delete message',
      description: 'This will permanently delete the message.',
      onConfirm: async () => {
        setConfirmDialog(null);
        setChatMessages((s) => s.filter((m) => m.id !== messageId));
        const { error } = await supabase.from('direct_messages').delete().eq('id', messageId);
        if (error) console.error('delete message error', error);
      },
    });
  }, []);

  const handleSendFriendRequest = useCallback(async (friendId: string) => {
    if (!user?.id) return;
    try {
      await supabase.from('friendships').insert([{ user_id: user.id, friend_id: friendId, status: 'pending' }]);
      await fetchAllUsers();
    } catch (err) {
      console.error('friend request error', err);
    }
  }, [user?.id, fetchAllUsers]);

  const handleAcceptRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
    if (error) console.error('accept request error', error);
    await fetchFriendRequests();
    await fetchFriends();
  }, [fetchFriendRequests, fetchFriends]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', requestId);
    if (error) console.error('decline request error', error);
    await fetchFriendRequests();
  }, [fetchFriendRequests]);

  const handleRemoveFriend = useCallback(async (friendId: string) => {
    setConfirmDialog({
      title: 'Remove friend',
      description: 'Are you sure you want to remove this friend?',
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!user?.id) return;
        await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
        await fetchFriends();
        setSelectedFriend(null);
      },
    });
  }, [user?.id, fetchFriends]);

  // Real-time subscription for messages + friendships
  useEffect(() => {
    if (!user?.id) return;

    const msgChannel = supabase
      .channel(`inbox-messages-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => {
        fetchMessages();
        if (selectedFriend) fetchChatMessages(selectedFriend.id);
      })
      .subscribe();

    const friendChannel = supabase
      .channel(`inbox-friends-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriendRequests();
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(friendChannel);
    };
  }, [user?.id, selectedFriend, fetchMessages, fetchChatMessages, fetchFriendRequests, fetchFriends]);

  // Initial data load once authenticated
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([fetchMessages(), fetchFriendRequests(), fetchFriends(), fetchAllUsers()]).finally(() => setLoading(false));
  }, [user?.id, fetchMessages, fetchFriendRequests, fetchFriends, fetchAllUsers]);

  // Search filtering
  const discoverList = useMemo(() => {
    if (!debouncedSearch) return allUsers;
    const q = debouncedSearch.toLowerCase();
    return allUsers.filter((u) => u.username.toLowerCase().includes(q));
  }, [allUsers, debouncedSearch]);

  // Statistics
  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const unreadMessages = messages.filter((m) => !m.is_read).length;
    const totalFriends = friends.length;
    const pendingRequests = friendRequests.length;
    return { totalMessages, unreadMessages, totalFriends, pendingRequests };
  }, [messages, friends, friendRequests]);

  // Autoscroll chat area on messages change
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  // Toggle star message
  const toggleStarMessage = (messageId: string) => {
    setStarredMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Copy message content
  const copyMessageContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy message', err);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden animate-in fade-in duration-500">
        <div className="px-4 md:px-6 py-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 flex gap-4 px-4 md:px-6 pb-6">
          <div className="w-80 space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Main layout
  return (
    <div className="h-screen flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 px-4 md:px-6 py-4 md:py-5 flex-shrink-0"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20 backdrop-blur-xl border border-primary/30">
                <InboxIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Messages</h1>
                <p className="text-sm text-muted-foreground">Direct messaging & friends</p>
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="hidden md:flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/50 backdrop-blur-xl border border-border/50">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{stats.totalMessages}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Messages</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/50 backdrop-blur-xl border border-border/50">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">{stats.totalFriends}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Friends</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {stats.pendingRequests > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/20 backdrop-blur-xl border border-orange-500/30"
                    >
                      <Bell className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-500">{stats.pendingRequests}</span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>Pending Requests</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-row gap-4 px-2 md:px-6 pb-3 md:pb-6 overflow-hidden min-h-0">
        {/* Left sidebar - hidden on mobile when chat is selected */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={`${selectedFriend ? 'hidden md:flex' : 'flex'} flex-col gap-3 min-h-0 w-full md:w-80 md:flex-none`}
        >
          {/* Search and tabs */}
          <Card className="shadow-card border-border/50 bg-card/50 backdrop-blur-xl">
            <CardContent className="p-3 md:p-4 space-y-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                />
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-4 w-full bg-muted/50 border border-border/50 h-10">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="messages" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                          <MessageSquare className="w-4 h-4" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Messages</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="friends" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                          <Users className="w-4 h-4" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Friends</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative transition-all">
                          <Mail className="w-4 h-4" />
                          {friendRequests.length > 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                            >
                              {friendRequests.length}
                            </motion.span>
                          )}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Pending Requests</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="discover" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                          <UserPlus className="w-4 h-4" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Discover People</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* List area - scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {activeTab === 'messages' &&
                  (messages.length === 0 ? (
                    <motion.div
                      variants={itemVariants}
                      className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-8 text-center"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <div className="relative w-16 h-16 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full flex items-center justify-center">
                          <Mail className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">No conversations yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Start connecting with friends!</p>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('discover')}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Find Friends
                      </Button>
                    </motion.div>
                  ) : (
                    (() => {
                      // Group messages by sender and show latest message per sender
                      const messageGroups = new Map<string, Message>();
                      messages.forEach((m) => {
                        if (!messageGroups.has(m.from_user_id) || new Date(m.created_at) > new Date(messageGroups.get(m.from_user_id)!.created_at)) {
                          messageGroups.set(m.from_user_id, m);
                        }
                      });
                      return Array.from(messageGroups.values()).map((m) => {
                        const sender = friends.find((f) => f.id === m.from_user_id) || allUsers.find((u) => u.id === m.from_user_id) || { username: 'Unknown', id: m.from_user_id };
                        const isSelected = selectedFriend?.id === m.from_user_id;
                        const isOnline = onlineUsers.has(m.from_user_id);
                        return (
                          <motion.button
                            key={m.id}
                            variants={itemVariants}
                            layout
                            onClick={() => {
                              setSelectedFriend({ id: sender.id, username: sender.username } as Profile);
                              fetchChatMessages(sender.id);
                              setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== m.id));
                            }}
                            className={`w-full rounded-2xl border bg-card/50 backdrop-blur-xl p-3 text-left transition-all group ${
                              isSelected 
                                ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10' 
                                : 'border-border/50 hover:bg-accent/10 hover:border-accent/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <UserAvatar username={sender.username} isOnline={isOnline} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="font-medium text-sm text-foreground truncate">{sender.username}</p>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(m.created_at)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
                              </div>
                              {!m.is_read && (
                                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                              )}
                            </div>
                          </motion.button>
                        );
                      });
                    })()
                  ))}

                {activeTab === 'friends' &&
                  (friends.length === 0 ? (
                    <motion.div
                      variants={itemVariants}
                      className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-8 text-center"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                        <div className="relative w-16 h-16 bg-gradient-to-br from-green-500/30 to-teal-500/30 rounded-full flex items-center justify-center">
                          <Users className="w-8 h-8 text-green-500" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">No friends yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Discover and connect with people!</p>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('discover')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Discover People
                      </Button>
                    </motion.div>
                  ) : (
                    friends.map((f) => {
                      const isOnline = onlineUsers.has(f.id);
                      return (
                        <motion.button
                          key={f.id}
                          variants={itemVariants}
                          layout
                          onClick={() => {
                            setSelectedFriend(f);
                            fetchChatMessages(f.id);
                          }}
                          className={`w-full rounded-2xl border bg-card/50 backdrop-blur-xl p-3 text-left transition-all group ${
                            selectedFriend?.id === f.id 
                              ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10' 
                              : 'border-border/50 hover:bg-accent/10 hover:border-accent/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar username={f.username} isOnline={isOnline} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm text-foreground truncate block">{f.username}</span>
                              <span className="text-xs text-muted-foreground">
                                {isOnline ? (
                                  <span className="text-green-500">Online</span>
                                ) : (
                                  'Offline'
                                )}
                              </span>
                            </div>
                            <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </motion.button>
                      );
                    })
                  ))}

                {activeTab === 'pending' &&
                  (friendRequests.length === 0 ? (
                    <motion.div
                      variants={itemVariants}
                      className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-8 text-center"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500/30 to-yellow-500/30 rounded-full flex items-center justify-center">
                          <Mail className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">No pending requests</h3>
                      <p className="text-sm text-muted-foreground">You're all caught up!</p>
                    </motion.div>
                  ) : (
                    friendRequests.map((r) => {
                      const requester = allUsers.find((u) => u.id === r.user_id) || { username: 'Unknown', id: r.user_id };
                      return (
                        <motion.div
                          key={r.id}
                          variants={itemVariants}
                          layout
                          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-4"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <UserAvatar username={requester.username} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{requester.username}</p>
                              <p className="text-xs text-muted-foreground">sent a friend request</p>
                              <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(r.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                              onClick={() => handleAcceptRequest(r.id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                              onClick={() => handleDeclineRequest(r.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })
                  ))}

                {activeTab === 'discover' &&
                  (discoverList.length === 0 ? (
                    <motion.div
                      variants={itemVariants}
                      className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-8 text-center"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full flex items-center justify-center">
                          <Search className="w-8 h-8 text-purple-500" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">No users found</h3>
                      <p className="text-sm text-muted-foreground">{searchQuery ? 'Try a different search term' : 'Start searching for people!'}</p>
                    </motion.div>
                  ) : (
                    discoverList.slice(0, 20).map((u) => {
                      const isFriend = friends.some((f) => f.id === u.id);
                      const hasPendingRequest = friendRequests.some((r) => r.user_id === u.id || r.friend_id === u.id);
                      return (
                        <motion.div
                          key={u.id}
                          variants={itemVariants}
                          layout
                          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-4"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <UserAvatar username={u.username} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{u.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {isFriend ? (
                                  <span className="text-green-500 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" /> Friend
                                  </span>
                                ) : hasPendingRequest ? (
                                  <span className="text-orange-500">Request pending</span>
                                ) : (
                                  'User'
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-primary hover:bg-primary/90"
                              onClick={() => {
                                setSelectedFriend({ id: u.id, username: u.username });
                                fetchChatMessages(u.id);
                                setActiveTab('messages');
                              }}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Message
                            </Button>
                            {!isFriend && !hasPendingRequest && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border hover:bg-accent/10"
                                onClick={() => handleSendFriendRequest(u.id)}
                              >
                                <UserPlus className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>

        {/* Right side - Chat */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={`${!selectedFriend ? 'hidden md:flex' : 'flex'} flex-1 flex-col gap-3 md:gap-4 overflow-hidden min-h-0`}
        >
          <AnimatePresence mode="wait">
            {!selectedFriend ? (
              <motion.div
                key="no-chat"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex items-center justify-center"
              >
                <Card className="border-border/50 bg-card/50 backdrop-blur-xl max-w-md">
                  <CardContent className="p-8 text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                      <div className="absolute inset-2 bg-primary/10 rounded-full animate-pulse [animation-delay:0.5s]" />
                      <div className="relative w-20 h-20 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-10 h-10 text-primary" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-xl text-foreground mb-2">Select a Conversation</h3>
                    <p className="text-sm text-muted-foreground mb-6">Choose a friend from the sidebar to start chatting</p>
                    <div className="flex justify-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{friends.length} friends</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MessageCircle className="w-4 h-4" />
                        <span>{messages.length} messages</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="chat-active"
                variants={slideInRight}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 flex flex-col gap-3 md:gap-4 overflow-hidden min-h-0"
              >
                {/* Chat header */}
                <Card className="shadow-card border-border/50 bg-card/50 backdrop-blur-xl flex-shrink-0">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="md:hidden h-9 w-9" 
                          onClick={() => { setSelectedFriend(null); setChatMessages([]); }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <UserAvatar username={selectedFriend.username} isOnline={onlineUsers.has(selectedFriend.id)} size="lg" />
                        <div className="min-w-0">
                          <h2 className="font-semibold text-foreground truncate">{selectedFriend.username}</h2>
                          <p className="text-xs text-muted-foreground">
                            {onlineUsers.has(selectedFriend.id) ? (
                              <span className="text-green-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                Online
                              </span>
                            ) : (
                              'Offline'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/profile/${selectedFriend.id}`)}>
                              <Users className="w-4 h-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Archive className="w-4 h-4 mr-2" />
                              Archive Chat
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemoveFriend(selectedFriend.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove Friend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Messages area */}
                <Card className="flex-1 shadow-card border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" ref={chatScrollRef}>
                    <AnimatePresence initial={false}>
                      {chatMessages.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="h-full flex items-center justify-center text-center"
                        >
                          <div>
                            <div className="relative w-16 h-16 mx-auto mb-4">
                              <div className="relative w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-primary" />
                              </div>
                            </div>
                            <h3 className="font-medium text-foreground mb-1">Start a conversation</h3>
                            <p className="text-sm text-muted-foreground">Send a message to {selectedFriend.username}!</p>
                          </div>
                        </motion.div>
                      ) : (
                        chatMessages.map((msg, index) => {
                          const isMine = msg.from_user_id === user?.id;
                          const isStarred = starredMessages.has(msg.id);
                          const showDateSeparator = index === 0 || 
                            new Date(msg.created_at).toDateString() !== new Date(chatMessages[index - 1].created_at).toDateString();
                          
                          return (
                            <React.Fragment key={msg.id}>
                              {showDateSeparator && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex items-center gap-4 py-2"
                                >
                                  <div className="flex-1 h-px bg-border/50" />
                                  <span className="text-xs text-muted-foreground px-2">
                                    {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                  </span>
                                  <div className="flex-1 h-px bg-border/50" />
                                </motion.div>
                              )}
                              <motion.div
                                variants={messageVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
                              >
                                <div className={`flex flex-col max-w-[75%] gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                                  <div className="flex items-end gap-2">
                                    {!isMine && (
                                      <UserAvatar username={selectedFriend.username} size="sm" />
                                    )}
                                    <div
                                      className={`relative px-4 py-2.5 rounded-2xl shadow-sm ${
                                        isMine
                                          ? 'bg-primary text-primary-foreground rounded-br-md'
                                          : 'bg-card border border-border/50 text-foreground rounded-bl-md'
                                      }`}
                                    >
                                      <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                      {isStarred && (
                                        <Star className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500 fill-yellow-500" />
                                      )}
                                    </div>
                                    
                                    {/* Message actions - visible on hover */}
                                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-first' : ''}`}>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                                            >
                                              <Smile className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>React</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => toggleStarMessage(msg.id)}
                                            >
                                              <Star className={`w-3.5 h-3.5 ${isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{isStarred ? 'Unstar' : 'Star'}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => copyMessageContent(msg.content)}
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Copy</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      
                                      {isMine && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Delete</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Reactions picker */}
                                  <AnimatePresence>
                                    {showReactions === msg.id && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        className="flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg"
                                      >
                                        {REACTIONS.map((emoji) => (
                                          <button
                                            key={emoji}
                                            onClick={() => setShowReactions(null)}
                                            className="hover:scale-125 transition-transform p-1"
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  
                                  <span className={`text-[10px] text-muted-foreground px-2 ${isMine ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </motion.div>
                            </React.Fragment>
                          );
                        })
                      )}
                    </AnimatePresence>
                    
                    {/* Typing indicator */}
                    <AnimatePresence>
                      {typingUsers.size > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="flex justify-start"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar username={selectedFriend.username} size="sm" />
                            <div className="px-4 py-2.5 rounded-2xl bg-card border border-border/50 rounded-bl-md">
                              <div className="flex items-center gap-1.5">
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Card>

                {/* Input area */}
                <Card className="shadow-card border-border/50 bg-card/50 backdrop-blur-xl flex-shrink-0">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 relative">
                        <textarea
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            setIsTyping(true);
                            if (typingTimeoutRef.current) {
                              clearTimeout(typingTimeoutRef.current);
                            }
                            typingTimeoutRef.current = setTimeout(() => {
                              setIsTyping(false);
                            }, 3000);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                              setIsTyping(false);
                            }
                          }}
                          className="w-full bg-background/50 border border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl p-3 pr-12 resize-none min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                          rows={1}
                          style={{
                            height: 'auto',
                            minHeight: '44px',
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                          }}
                        />
                        <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
                          ⌘↵
                        </div>
                      </div>
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim()} 
                        className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <AlertDialog open={true} onOpenChange={(val) => !val && setConfirmDialog(null)}>
            <AlertDialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">{confirmDialog.title}</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">{confirmDialog.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3 mt-4 justify-end">
                <AlertDialogCancel className="border-border hover:bg-accent/10">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmDialog.onConfirm} 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                >
                  Confirm
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </AnimatePresence>
    </div>
  );
}
