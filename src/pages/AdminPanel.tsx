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

  // ...existing code for rendering UI...
  // (omitted for brevity, as the logic is unchanged)

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ...existing UI code... */}
          <div className="mb-4">
            {locked ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (password === correctPassword) {
                    setLocked(false);
                    setError('');
                  } else {
                    setError('Incorrect password');
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Admin Password"
                />
                <Button type="submit">Unlock</Button>
              </form>
            ) : (
              <Button variant="outline" onClick={() => setLocked(true)}>
                Lock
              </Button>
            )}
            {error && <div className="text-red-500 mt-2">{error}</div>}
          </div>

          {!locked && (
            <>
              <div className="mb-6">
                <h2 className="font-semibold mb-2">Global Settings</h2>
                {settingsError && <div className="text-red-500 mb-2">{settingsError}</div>}
                {loadingSettings ? (
                  <div>Loading...</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {Object.entries(settings).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="capitalize flex-1">{key.replace(/_/g, ' ')}</span>
                        <Button
                          size="sm"
                          variant={value ? 'default' : 'outline'}
                          onClick={() => updateSetting(key, !value)}
                        >
                          {value ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-6">
                <h2 className="font-semibold mb-2">Leaderboard Actions</h2>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="User ID"
                  />
                  <Input
                    value={points}
                    onChange={e => setPoints(e.target.value)}
                    placeholder="Points"
                    type="number"
                  />
                  <Button onClick={addPoints}>Set Points</Button>
                  <Button variant="destructive" onClick={removeUser}>Remove User</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
