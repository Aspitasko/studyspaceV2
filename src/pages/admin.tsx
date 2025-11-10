import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


export default function AdminPanel() {
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [points, setPoints] = useState('');
  const [settings, setSettings] = useState({
    dms_enabled: true,
    notes_enabled: true,
    ai_enabled: true,
    general_chat_locked: false,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  // Fetch settings on mount
  useEffect(() => {
    if (!locked) {
      setLoadingSettings(true);
      (supabase as any).from('settings').select('*').limit(1)
        .then(({ data, error }: any) => {
          if (error) setSettingsError('Failed to load settings');
          else if (data && data.length > 0) setSettings(data[0]);
        })
        .finally(() => setLoadingSettings(false));
    }
  }, [locked]);

  // Update a setting
  const updateSetting = async (key: string, value: boolean) => {
    setLoadingSettings(true);
    // Always update the first row
    const { data } = await (supabase as any).from('settings').select('id').limit(1);
    if (data && data.length > 0) {
      await (supabase as any).from('settings').update({ [key]: value }).eq('id', data[0].id);
      // Fetch the updated settings row to ensure UI is in sync
      const { data: updated } = await (supabase as any).from('settings').select('*').limit(1);
      if (updated && updated.length > 0) setSettings(updated[0]);
    }
    setLoadingSettings(false);
  };

  // Leaderboard actions
  const addPoints = async () => {
    if (!userId || !points) return;
    await supabase.from('profiles').update({ points: Number(points) }).eq('id', userId);
    setUserId(''); setPoints('');
  };
  const removeUser = async () => {
    if (!userId) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setUserId('');
  };

  const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      setLocked(false);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  if (locked) {
    return (
      <div className="max-w-xs mx-auto py-20">
        <Card>
          <CardHeader>
            <CardTitle>Admin Panel Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <Button type="submit" className="w-full">Unlock</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-6 space-y-2 text-base">
            <li>
              <b>Open your Supabase dashboard</b> and go to the <b>settings</b> table.
            </li>
            <li>
              Edit the <b>settings</b> row directly:
              <ul className="list-disc pl-6 mt-1">
                <li><b>dms_enabled</b>: Set to <code>true</code> or <code>false</code> to enable/disable DMs.</li>
                <li><b>notes_enabled</b>: Set to <code>true</code> or <code>false</code> to allow/disallow everyone to add notes.</li>
                <li><b>ai_enabled</b>: Set to <code>true</code> or <code>false</code> to enable/disable both AIs.</li>
                <li><b>general_chat_locked</b>: Set to <code>true</code> to lock general chat, <code>false</code> to unlock.</li>
              </ul>
            </li>
            <li>
              For leaderboard management, use the <b>profiles</b> table:
              <ul className="list-disc pl-6 mt-1">
                <li>To add points: Edit the <b>points</b> column for a user.</li>
                <li>To remove a user: Delete the user row from <b>profiles</b>.</li>
              </ul>
            </li>
            <li>
              For tasks, notes, and chat moderation, use the <b>tasks</b>, <b>notes</b>, and <b>chat_messages</b> tables as needed.
            </li>
          </ol>
          <div className="mt-4 text-muted-foreground text-sm">
            <b>Note:</b> The in-app admin panel controls are currently disabled. Please use the Supabase dashboard for all admin actions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
