-- Migration: Add WebRTC Signaling Support
-- Run this SQL in your Supabase SQL Editor

-- WEBRTC SIGNALING TABLE
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  signal_type TEXT CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')) NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view signals in their rooms"
  ON public.webrtc_signals FOR SELECT
  USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

CREATE POLICY "Users can send signals in their rooms"
  ON public.webrtc_signals FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id AND
    EXISTS (
      SELECT 1 FROM public.room_participants
      WHERE room_id = webrtc_signals.room_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Users can delete their own signals"
  ON public.webrtc_signals FOR DELETE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Enable realtime for WebRTC signaling and related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_rooms;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_user ON public.webrtc_signals(to_user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_room ON public.webrtc_signals(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);
