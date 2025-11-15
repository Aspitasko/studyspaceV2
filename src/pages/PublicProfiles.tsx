import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Flame, TrendingUp } from 'lucide-react';

interface PublicProfile {
  id: string;
  username: string;
  streak: number;
  points: number;
  rank: number;
  avatar_url: string | null;
}

const PublicProfiles = () => {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community Leaderboard</h1>
        <p className="text-muted-foreground">Discover and connect with other students</p>
      </div>

      <div className="relative">
        <Input
          type="text"
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No public profiles found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => (
            <Card
              key={profile.id}
              className="shadow-card hover:shadow-card-hover transition-smooth cursor-pointer group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="break-words text-lg">
                      {profile.username}
                    </CardTitle>
                    {profile.rank && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Rank #{profile.rank}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-3 bg-card rounded-lg">
                    <Flame className="h-4 w-4 text-accent mb-1" />
                    <p className="text-lg font-bold">{profile.streak}</p>
                    <p className="text-xs text-muted-foreground">Streak</p>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-card rounded-lg">
                    <TrendingUp className="h-4 w-4 text-secondary mb-1" />
                    <p className="text-lg font-bold">{profile.points}</p>
                    <p className="text-xs text-muted-foreground">Points</p>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-card rounded-lg">
                    <Trophy className="h-4 w-4 text-yellow-500 mb-1" />
                    <p className="text-lg font-bold">{profile.rank}</p>
                    <p className="text-xs text-muted-foreground">Rank</p>
                  </div>
                </div>

                <div className="pt-2 border-t text-center">
                  <p className="text-xs text-muted-foreground group-hover:text-accent transition-colors">
                    Click to view profile
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicProfiles;
