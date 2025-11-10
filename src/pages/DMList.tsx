import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function DMList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    // Get all users you have sent or received a DM with
  supabase.rpc('get_dm_conversations', { user_id: user.id })
      .then(({ data }) => setConversations(data || []));
  }, [user]);

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Direct Messages</CardTitle>
            <span className="bg-yellow-200 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">Beta</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link to={`/dms/${c.id}`} className="hover:underline">
                  {c.username || c.email}
                </Link>
              </li>
            ))}
            {conversations.length === 0 && <li className="text-muted-foreground">No conversations yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
