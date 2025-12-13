import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Trophy,
  Flame,
  TrendingUp,
  MessageSquare,
  UserPlus,
  UserCheck,
  Calendar,
  Clock,
  Target,
  Award,
  Star,
  BookOpen,
  CheckCircle2,
  ArrowLeft,
  Share2,
  MoreHorizontal,
  MapPin,
  Link as LinkIcon,
  Mail,
  Github,
  Twitter,
  Linkedin,
  Sparkles,
  Zap,
  Heart,
  Eye,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProfileData {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  streak: number;
  points: number;
  rank: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  is_admin?: boolean;
  // Additional fields for UI (with defaults)
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
}

interface ProfileStats {
  total_tasks: number;
  completed_tasks: number;
  total_notes: number;
}

interface Activity {
  id: string;
  type: 'task' | 'note' | 'achievement' | 'study_session';
  title: string;
  description?: string;
  created_at: string;
  icon: any;
  color: string;
}

const Profile = () => {
  const { userId: rawUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Handle "me" as a special case for viewing own profile
  const userId = rawUserId === 'me' ? user?.id : rawUserId;
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchStats();
      fetchActivities();
      if (!isOwnProfile) {
        checkFriendship();
      }
    }
  }, [userId, user?.id]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Profile data now includes all fields from database
      setProfile({
        id: data.id,
        username: data.username,
        email: data.email,
        avatar_url: data.avatar_url || undefined,
        streak: data.streak || 0,
        points: data.points || 0,
        rank: data.rank || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        is_public: data.is_public ?? true,
        is_admin: data.is_admin || false,
        bio: data.bio || '',
        location: data.location || '',
        website: data.website || '',
        github: data.github || '',
        twitter: data.twitter || '',
        linkedin: data.linkedin || '',
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('completed')
        .eq('user_id', userId);

      // Fetch notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', userId);

      setStats({
        total_tasks: tasks?.length || 0,
        completed_tasks: tasks?.filter((t) => t.completed).length || 0,
        total_notes: notes?.length || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchActivities = async () => {
    try {
      // Fetch recent completed tasks
      const { data: recentTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true)
        .order('updated_at', { ascending: false })
        .limit(10);

      // Fetch recent notes
      const { data: recentNotes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const combinedActivities: Activity[] = [];

      // Add tasks as activities
      recentTasks?.forEach((task) => {
        combinedActivities.push({
          id: task.id,
          type: 'task',
          title: 'Completed task',
          description: task.title,
          created_at: task.updated_at,
          icon: CheckCircle2,
          color: 'text-green-500',
        });
      });

      // Add notes as activities
      recentNotes?.forEach((note) => {
        combinedActivities.push({
          id: note.id,
          type: 'note',
          title: 'Created note',
          description: note.title,
          created_at: note.created_at,
          icon: BookOpen,
          color: 'text-blue-500',
        });
      });

      // Sort by date and limit to 10
      combinedActivities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(combinedActivities.slice(0, 10));
    } catch (err) {
      console.error('Error fetching activities:', err);
      setActivities([]);
    }
  };

  const checkFriendship = async () => {
    if (!user?.id || !userId) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`);

    if (friendships && friendships.length > 0) {
      const friendship = friendships[0];
      setIsFriend(friendship.status === 'accepted');
      setHasPendingRequest(friendship.status === 'pending');
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user?.id || !userId) return;
    try {
      await supabase.from('friendships').insert([
        { user_id: user.id, friend_id: userId, status: 'pending' },
      ]);
      setHasPendingRequest(true);
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  const handleSendMessage = () => {
    navigate(`/inbox?chat=${userId}`);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${userId}`;
    if (navigator.share) {
      await navigator.share({
        title: `${profile?.username}'s Profile`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const getCompletionRate = () => {
    if (!stats || stats.total_tasks === 0) return 0;
    return Math.round((stats.completed_tasks / stats.total_tasks) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Profile not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      {/* Header Card with Cover */}
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
        {/* Cover Image / Gradient */}
        <div className="relative h-48 bg-gradient-to-br from-primary via-accent to-secondary">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 bg-background/50 backdrop-blur hover:bg-background/70"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {isOwnProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 bg-background/50 backdrop-blur hover:bg-background/70"
              onClick={() => navigate('/settings')}
            >
              Edit Profile
            </Button>
          )}
        </div>

        <CardContent className="relative pt-0 pb-6">
          {/* Avatar */}
          <div className="flex flex-col md:flex-row gap-6 -mt-16 md:-mt-12">
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-background shadow-2xl">
                <AvatarImage src={profile.avatar_url} alt={profile.username} />
                <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.streak > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white rounded-full p-2 shadow-lg">
                  <Flame className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex-1 md:mt-16">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-foreground">{profile.username}</h1>
                    {profile.rank <= 10 && (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                        <Trophy className="w-3 h-3 mr-1" />
                        Top 10
                      </Badge>
                    )}
                  </div>
                  {profile.bio && (
                    <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined {formatDate(profile.created_at)}
                    </div>
                    {profile.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {profile.location}
                      </div>
                    )}
                  </div>
                  {/* Social Links */}
                  {(profile.website || profile.github || profile.twitter || profile.linkedin) && (
                    <div className="flex items-center gap-2 pt-2">
                      {profile.website && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(profile.website, '_blank')}
                              >
                                <LinkIcon className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Website</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {profile.github && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(`https://github.com/${profile.github}`, '_blank')}
                              >
                                <Github className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>GitHub</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {profile.twitter && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(`https://twitter.com/${profile.twitter}`, '_blank')}
                              >
                                <Twitter className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Twitter</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {profile.linkedin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(`https://linkedin.com/in/${profile.linkedin}`, '_blank')}
                              >
                                <Linkedin className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>LinkedIn</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isOwnProfile && (
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSendMessage} className="bg-primary hover:bg-primary/90">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    {!isFriend && !hasPendingRequest && (
                      <Button onClick={handleSendFriendRequest} variant="outline">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Friend
                      </Button>
                    )}
                    {hasPendingRequest && (
                      <Button variant="outline" disabled>
                        <Clock className="w-4 h-4 mr-2" />
                        Pending
                      </Button>
                    )}
                    {isFriend && (
                      <Button variant="outline" disabled>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Friends
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleShare}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          View Public Profile
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="hover:shadow-lg transition-all border-border/50 bg-card/50 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">{profile.streak}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="hover:shadow-lg transition-all border-border/50 bg-card/50 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">{profile.points.toLocaleString()}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Total Points</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="hover:shadow-lg transition-all border-border/50 bg-card/50 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-yellow-500/10 rounded-full">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">#{profile.rank}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Global Rank</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="hover:shadow-lg transition-all border-border/50 bg-card/50 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.completed_tasks || 0}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Tasks Done</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Progress Cards */}
              <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Progress Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Task Completion</span>
                      <span className="text-sm font-semibold text-primary">{getCompletionRate()}%</span>
                    </div>
                    <Progress value={getCompletionRate()} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats?.completed_tasks} of {stats?.total_tasks} tasks completed
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-500">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-sm font-medium">Notes Created</span>
                      </div>
                      <p className="text-3xl font-bold">{stats?.total_notes || 0}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">Total Tasks</span>
                      </div>
                      <p className="text-3xl font-bold">{stats?.total_tasks || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Current Streak</span>
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">{profile.streak} days</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Total XP</span>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold">{profile.points.toLocaleString()}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">World Rank</span>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold">#{profile.rank}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Member Since</span>
                    <span className="text-sm font-medium">{formatDate(profile.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <AnimatePresence>
                    {activities.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className={`p-2 rounded-full bg-background ${activity.color}`}>
                          <activity.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.title}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(activity.created_at)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {activities.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </motion.div>
  );
};

export default Profile;
