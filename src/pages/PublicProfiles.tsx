import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Flame, TrendingUp, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface PublicProfile {
  id: string;
  username: string;
  streak: number;
  points: number;
  rank: number;
  avatar_url: string | null;
}

const PublicProfiles = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<PublicProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicProfiles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProfiles(profiles);
    } else {
      setFilteredProfiles(
        profiles.filter((p) =>
          p.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, profiles]);

  const fetchPublicProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, streak, points, rank, avatar_url')
        .eq('is_public', true)
        .order('rank', { ascending: true })
        .limit(50) as any;

      if (!error && data) {
        setFilteredProfiles(data as PublicProfile[]);
        setProfiles(data as PublicProfile[]);
      }
    } catch (err) {
      console.error('Error fetching public profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold mb-2">Community Leaderboard</h1>
        <p className="text-muted-foreground">Discover and connect with other students</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="shadow-card border-border/50 bg-card/50 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No public profiles found</p>
            {searchQuery && (
              <p className="text-sm text-muted-foreground mt-2">Try a different search term</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                onClick={() => navigate(`/profile/${profile.id}`)}
                className="shadow-card hover:shadow-card-hover transition-all cursor-pointer group border-border/50 bg-card/50 backdrop-blur-xl hover:scale-105 hover:border-primary/30"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="break-words text-lg group-hover:text-primary transition-colors">
                        {profile.username}
                      </CardTitle>
                      {profile.rank && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Rank #{profile.rank}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg group-hover:bg-orange-500/10 transition-colors">
                      <Flame className="h-4 w-4 text-orange-500 mb-1" />
                      <p className="text-lg font-bold">{profile.streak}</p>
                      <p className="text-xs text-muted-foreground">Streak</p>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg group-hover:bg-blue-500/10 transition-colors">
                      <TrendingUp className="h-4 w-4 text-blue-500 mb-1" />
                      <p className="text-lg font-bold">{profile.points}</p>
                      <p className="text-xs text-muted-foreground">Points</p>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg group-hover:bg-yellow-500/10 transition-colors">
                      <Trophy className="h-4 w-4 text-yellow-500 mb-1" />
                      <p className="text-lg font-bold">{profile.rank}</p>
                      <p className="text-xs text-muted-foreground">Rank</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t text-center">
                    <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-medium">
                      Click to view full profile →
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicProfiles;
