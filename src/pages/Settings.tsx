import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useThemeManager } from '@/hooks/use-theme-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Lock, User, Palette, Shield, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadAvatar } from '@/lib/file-upload';

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTheme, changeTheme } = useThemeManager();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loadingUsername, setLoadingUsername] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('username, is_public, avatar_url, bio, location, website, github, twitter, linkedin')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setUsername(data.username);
        setIsPublic(data.is_public ?? true);
        setAvatarUrl(data.avatar_url || '');
        setBio(data.bio || '');
        setLocation(data.location || '');
        setWebsite(data.website || '');
        setGithub(data.github || '');
        setTwitter(data.twitter || '');
        setLinkedin(data.linkedin || '');
      }
    };

    fetchProfile();
  }, [user]);

  const handleUsernameChange = async () => {
    if (!user || !username.trim()) {
      toast({
        title: 'Error',
        description: 'Username cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setLoadingUsername(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Username updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update username',
        variant: 'destructive',
      });
    } finally {
      setLoadingUsername(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'All password fields are required',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoadingPassword(true);
    try {
      // First verify current password by attempting to sign in
      if (!user?.email) throw new Error('User email not found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) throw new Error('Current password is incorrect');

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Password updated successfully',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'User email not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password reset email sent. Check your inbox.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reset email',
        variant: 'destructive',
      });
    }
  };

  const handlePrivacyToggle = async (value: boolean) => {
    if (!user) return;
    
    setLoadingPrivacy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_public: value })
        .eq('id', user.id);

      if (error) throw error;

      setIsPublic(value);
      toast({
        title: 'Success',
        description: value 
          ? 'Profile is now public. You appear in the community leaderboard.' 
          : 'Profile is now private. You are hidden from the community leaderboard.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update privacy settings',
        variant: 'destructive',
      });
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setLoadingAvatar(true);
    try {
      const result = await uploadAvatar(file, user.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update profile with new avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: result.path })
        .eq('id', user.id);

      if (error) throw error;

      setAvatarUrl(result.path || '');
      toast({
        title: 'Success',
        description: 'Avatar updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setLoadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setLoadingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setAvatarUrl('');
      toast({
        title: 'Success',
        description: 'Avatar removed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove avatar',
        variant: 'destructive',
      });
    } finally {
      setLoadingAvatar(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;

    setLoadingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bio: bio.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
          github: github.trim() || null,
          twitter: twitter.trim() || null,
          linkedin: linkedin.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const THEMES = [
    {
      id: 'default',
      name: 'Default Dark',
      description: 'A sleek dark theme',
      bgImage: 'url(/background.png)',
      colors: 'bg-slate-900',
      beta: false,
    },
    {
      id: 'forest',
      name: 'Forest Green',
      description: 'A lush green theme with green and dark green UI',
      bgImage: 'url(/green.jpg)',
      colors: 'bg-green-900',
      beta: false,
    },
    {
      id: 'orange',
      name: 'Sunset Orange',
      description: 'A warm theme with orange, yellow, red and black',
      bgImage: 'url(/orange.jpg)',
      colors: 'bg-orange-900',
      beta: false,
    },
    {
      id: 'purple',
      name: 'Mystical Purple',
      description: 'An elegant theme with purple and dark purple',
      bgImage: 'url(/purple.jpg)',
      colors: 'bg-purple-900',
      beta: false,
    },
    {
      id: 'midnight',
      name: 'Midnight',
      description: 'A monochrome theme with black, white and grey',
      bgImage: 'url(/midnight.jpg)',
      colors: 'bg-gray-900',
      beta: false,
      betaStatus: 'Performance',
    },
    {
      id: 'cherry',
      name: 'Cherry Blossom',
      description: 'Soft pink and white, Japanese aesthetic',
      bgImage: 'url(/cherry.jpg)',
      colors: 'bg-pink-200',
      beta: false,
    },
    {
      id: 'solarized',
      name: 'Solarized',
      description: 'Easy on the eyes, balanced color scheme',
      bgImage: 'url(/solarized.jpg)',
      colors: 'bg-cyan-900',
      beta: false,
    },
    {
      id: 'coffee',
      name: 'Coffee',
      description: 'Warm browns and creams, cozy espresso vibes',
      bgImage: 'url(/coffee.jpg)',
      colors: 'bg-amber-900',
      beta: false,
    },
    {
      id: 'highcontrast',
      name: 'High Contrast',
      description: 'Accessibility-focused, pure black and white',
      bgImage: 'url(/highcontrast.jpg)',
      colors: 'bg-black',
      beta: false,
      betaStatus: 'Accessibility',
    },
    {
      id: 'autumn',
      name: 'Autumn',
      description: 'Warm reds, oranges, and browns like fall leaves',
      bgImage: 'url(/autumn.jpg)',
      colors: 'bg-orange-800',
      beta: false,
    },
    {
      id: 'rosegold',
      name: 'Rose Gold',
      description: 'Elegant pink and gold tones',
      bgImage: 'url(/rosegold.jpg)',
      colors: 'bg-rose-300',
      beta: false,
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk',
      description: 'Neon pink, cyan, and dark purple - futuristic vibes',
      bgImage: 'url(/cyberpunk.jpg)',
      colors: 'bg-fuchsia-900',
      beta: false,
    },
  ];

  const handleThemeChange = (themeId: string) => {
    changeTheme(themeId);
    
    toast({
      title: 'Success',
      description: `Theme changed to ${THEMES.find((t) => t.id === themeId)?.name}`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Password</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Upload or change your avatar (Max 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingAvatar}
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {loadingAvatar ? 'Uploading...' : 'Upload'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      onClick={handleRemoveAvatar}
                      disabled={loadingAvatar}
                      variant="outline"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square image, at least 200x200px. Supports JPG, PNG, WebP, GIF
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Username</CardTitle>
              <CardDescription>Change your username</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                />
              </div>
              <Button onClick={handleUsernameChange} disabled={loadingUsername}>
                {loadingUsername ? 'Updating...' : 'Update Username'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bio & Info</CardTitle>
              <CardDescription>Tell others about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a short bio about yourself..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github">GitHub</Label>
                  <Input
                    id="github"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter/X</Label>
                  <Input
                    id="twitter"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="username"
                  />
                </div>
              </div>

              <Button onClick={handleProfileUpdate} disabled={loadingProfile}>
                {loadingProfile ? 'Updating...' : 'Update Profile Info'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>Your account email address</CardDescription>
            </CardHeader>
            <CardContent>
              <Input value={user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground mt-2">
                Email cannot be changed. Contact support if needed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                />
              </div>
              <Button onClick={handlePasswordChange} disabled={loadingPassword}>
                {loadingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Send a password reset email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you forgot your password, you can request a reset email.
              </p>
              <Button variant="outline" onClick={handleResetPassword}>
                Send Reset Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Visibility</CardTitle>
              <CardDescription>Control who can see your profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Make Profile Public</Label>
                  <p className="text-sm text-muted-foreground">
                    {isPublic 
                      ? 'Your profile appears in the community leaderboard' 
                      : 'Your profile is hidden from other users'}
                  </p>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={handlePrivacyToggle}
                  disabled={loadingPrivacy}
                />
              </div>
              
              <div className="space-y-3 p-4 bg-muted/20 rounded-lg">
                <h4 className="font-semibold text-sm">Public Profile Shows:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Your username</li>
                  <li>✓ Your rank and points</li>
                  <li>✓ Your study streak</li>
                  <li>✗ Your email (never shared)</li>
                  <li>✗ Your personal notes (only public notes visible)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Choose a Theme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {THEMES.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      currentTheme === t.id
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {t.beta && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                          Beta
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-600 border-orange-500/30">
                          {t.betaStatus}
                        </Badge>
                      </div>
                    )}
                    {!t.beta && t.betaStatus && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge variant="outline" className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                          {t.betaStatus}
                        </Badge>
                      </div>
                    )}
                    <div
                      className={`w-full h-32 rounded-md mb-3 ${t.colors} opacity-30 border border-border`}
                      style={{
                        backgroundImage: t.bgImage,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{t.name}</h3>
                        {currentTheme === t.id && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
