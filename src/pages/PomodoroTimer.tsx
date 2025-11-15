import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';

type TimerMode = 'work' | 'break' | 'longBreak';

interface TimerSettings {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export default function PomodoroTimer() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TimerSettings>({
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
  });

  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [editingSettings, setEditingSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound notification
  const playSound = () => {
    if (isSoundOn && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Fallback: use Web Audio API
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.5);
      });
    }
  };

  // Timer logic
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          handleTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleTimerEnd = () => {
    playSound();
    setIsRunning(false);

    if (mode === 'work') {
      setSessionsCompleted((prev) => prev + 1);

      const nextMode =
        (sessionsCompleted + 1) % settings.sessionsBeforeLongBreak === 0 ? 'longBreak' : 'break';

      toast({
        title: `${mode === 'work' ? 'Work Session Complete!' : 'Break Over!'}`,
        description: `Get ready for ${nextMode === 'longBreak' ? 'a long break' : 'a break'}`,
      });

      setMode(nextMode);
      setTimeLeft(
        nextMode === 'break'
          ? settings.breakDuration * 60
          : settings.longBreakDuration * 60
      );
    } else {
      toast({
        title: 'Break Over!',
        description: 'Ready for another work session?',
      });

      setMode('work');
      setTimeLeft(settings.workDuration * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode('work');
    setTimeLeft(settings.workDuration * 60);
    setSessionsCompleted(0);
    toast({
      title: 'Timer Reset',
      description: 'All sessions cleared',
    });
  };

  const handleSettingChange = (key: keyof TimerSettings, value: number) => {
    const newSettings = { ...settings, [key]: Math.max(1, value) };
    setSettings(newSettings);

    if (mode === 'work') {
      setTimeLeft(newSettings.workDuration * 60);
    } else if (mode === 'break') {
      setTimeLeft(newSettings.breakDuration * 60);
    } else {
      setTimeLeft(newSettings.longBreakDuration * 60);
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case 'work':
        return 'from-blue-500 to-blue-600';
      case 'break':
        return 'from-green-500 to-green-600';
      case 'longBreak':
        return 'from-purple-500 to-purple-600';
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'work':
        return 'Focus Time';
      case 'break':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Pomodoro Timer</h1>
        <p className="text-muted-foreground">
          Stay focused with the Pomodoro Technique - work in focused intervals with breaks
        </p>
      </div>

      {/* Main Timer Display */}
      <Card className="shadow-lg border-0">
        <CardContent className="pt-8">
          <div className={`bg-gradient-to-br ${getModeColor()} rounded-3xl p-12 text-center text-white`}>
            <div className="text-lg font-semibold mb-2 opacity-90">{getModeLabel()}</div>
            <div className="text-8xl font-bold font-mono mb-2">{formatTime(timeLeft)}</div>
            <div className="text-sm opacity-75">
              Sessions Completed: {sessionsCompleted}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-4 justify-center mt-8">
            <Button
              size="lg"
              onClick={() => setIsRunning(!isRunning)}
              className={`px-8 ${
                isRunning
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start
                </>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleReset}
              className="px-8"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Reset
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={() => setIsSoundOn(!isSoundOn)}
              className="px-4"
            >
              {isSoundOn ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Switch Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button
              onClick={() => {
                setMode('work');
                setTimeLeft(settings.workDuration * 60);
                setIsRunning(false);
              }}
              variant={mode === 'work' ? 'default' : 'outline'}
              className="w-full"
            >
              Focus
            </Button>
            <Button
              onClick={() => {
                setMode('break');
                setTimeLeft(settings.breakDuration * 60);
                setIsRunning(false);
              }}
              variant={mode === 'break' ? 'default' : 'outline'}
              className="w-full"
            >
              Break
            </Button>
            <Button
              onClick={() => {
                setMode('longBreak');
                setTimeLeft(settings.longBreakDuration * 60);
                setIsRunning(false);
              }}
              variant={mode === 'longBreak' ? 'default' : 'outline'}
              className="w-full"
            >
              Long Break
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Settings</CardTitle>
          <Button
            size="sm"
            variant={editingSettings ? 'default' : 'outline'}
            onClick={() => setEditingSettings(!editingSettings)}
          >
            {editingSettings ? 'Done' : 'Edit'}
          </Button>
        </CardHeader>
        {editingSettings && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="work-duration">Work Duration (minutes)</Label>
              <Input
                id="work-duration"
                type="number"
                min="1"
                max="60"
                value={settings.workDuration}
                onChange={(e) => handleSettingChange('workDuration', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="break-duration">Break Duration (minutes)</Label>
              <Input
                id="break-duration"
                type="number"
                min="1"
                max="30"
                value={settings.breakDuration}
                onChange={(e) => handleSettingChange('breakDuration', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="long-break-duration">Long Break Duration (minutes)</Label>
              <Input
                id="long-break-duration"
                type="number"
                min="1"
                max="60"
                value={settings.longBreakDuration}
                onChange={(e) => handleSettingChange('longBreakDuration', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sessions-before-long-break">Sessions Before Long Break</Label>
              <Input
                id="sessions-before-long-break"
                type="number"
                min="1"
                max="10"
                value={settings.sessionsBeforeLongBreak}
                onChange={(e) => handleSettingChange('sessionsBeforeLongBreak', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
          </CardContent>
        )}
        {!editingSettings && (
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Focus Time:</span>
              <span className="font-semibold">{settings.workDuration} minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Break Time:</span>
              <span className="font-semibold">{settings.breakDuration} minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Long Break:</span>
              <span className="font-semibold">{settings.longBreakDuration} minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sessions Before Long Break:</span>
              <span className="font-semibold">{settings.sessionsBeforeLongBreak}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Pomodoro Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-semibold">✓ Minimize Distractions:</span> Put your phone on silent
            and close unnecessary tabs during focus sessions.
          </p>
          <p>
            <span className="font-semibold">✓ Track Your Pomodoros:</span> Monitor how many Pomodoros
            you complete to improve productivity.
          </p>
          <p>
            <span className="font-semibold">✓ Use Breaks Wisely:</span> Step away from your desk and
            stretch during break time.
          </p>
          <p>
            <span className="font-semibold">✓ Adjust as Needed:</span> Customize session lengths to
            match your work style.
          </p>
        </CardContent>
      </Card>

      {/* Hidden audio element for notification sound */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj=="
      />
    </div>
  );
}
