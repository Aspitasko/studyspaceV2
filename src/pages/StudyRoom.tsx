import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useThemeManager } from '@/hooks/use-theme-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Video, Mic, MicOff, VideoOff, Phone, Send, Users, Copy, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Participant {
  id: string;
  username: string;
  user_id: string;
  is_active: boolean;
}

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

interface PeerConnection {
  peerConnection: RTCPeerConnection;
  stream: MediaStream | null;
}

export default function StudyRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTheme } = useThemeManager();

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const signalingChannelRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Optimized ICE servers and WebRTC configuration for lowest latency
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  useEffect(() => {
    if (!roomId || !user) return;

    const initializeRoom = async () => {
      await fetchRoom();
      await fetchParticipants();
      await fetchMessages();
      await initializeLocalStream();
      await setupSignalingChannel();
      isInitializedRef.current = true;
    };

    initializeRoom();

    return () => {
      cleanup();
    };
  }, [roomId, user]);

  // Auto-redirect when current user leaves the room
  useEffect(() => {
    if (loading || !user || !isInitializedRef.current) return;
    
    const currentUserInRoom = participants.some(p => p.user_id === user.id);
    
    if (participants.length > 0 && !currentUserInRoom) {
      toast({
        title: 'Room Empty',
        description: 'You have left the room',
      });
      navigate('/study-rooms');
    }
  }, [participants, user, loading, navigate, toast]);

  // Setup WebRTC connections when participants change
  useEffect(() => {
    if (!isInitializedRef.current || !localStreamRef.current || !user) return;
    
    // Create connections for new participants
    participants.forEach(participant => {
      if (participant.user_id !== user.id && !peerConnectionsRef.current.has(participant.user_id)) {
        createPeerConnection(participant.user_id, participant.username);
      }
    });

    // Remove connections for participants who left
    const participantIds = new Set(participants.map(p => p.user_id));
    peerConnectionsRef.current.forEach((_, userId) => {
      if (userId !== user.id && !participantIds.has(userId)) {
        closePeerConnection(userId);
      }
    });
  }, [participants, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cleanup = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((peerConn) => {
      peerConn.peerConnection.close();
    });
    peerConnectionsRef.current.clear();

    // Remove signaling channel
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }

    isInitializedRef.current = false;
  };

  const setupSignalingChannel = async () => {
    if (!roomId || !user) return;

    // Subscribe to signaling messages
    const channel = supabase
      .channel(`webrtc_signals_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const signal = payload.new;
          await handleSignal(signal);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    signalingChannelRef.current = channel;
  };

  const handleSignal = async (signal: any) => {
    const { from_user_id, signal_type, signal_data } = signal;

    console.log('Received signal:', signal_type, 'from:', from_user_id);

    if (signal_type === 'offer') {
      await handleOffer(from_user_id, signal_data);
    } else if (signal_type === 'answer') {
      await handleAnswer(from_user_id, signal_data);
    } else if (signal_type === 'ice-candidate') {
      await handleIceCandidate(from_user_id, signal_data);
    }
  };

  const sendSignal = async (toUserId: string, signalType: string, signalData: any) => {
    if (!roomId || !user) return;

    try {
      await supabase.from('webrtc_signals').insert({
        room_id: roomId,
        from_user_id: user.id,
        to_user_id: toUserId,
        signal_type: signalType,
        signal_data: signalData,
      });
    } catch (err) {
      console.error('Error sending signal:', err);
    }
  };

  const fetchRoom = async () => {
    try {
      const { data, error } = await supabase
        .from('study_rooms')
        .select('*')
        .eq('id', roomId)
        .single() as any;

      if (error || !data) {
        toast({
          title: 'Error',
          description: 'Room not found',
          variant: 'destructive',
        });
        navigate('/study-rooms');
        return;
      }

      setRoom(data);
    } catch (err) {
      console.error('Error fetching room:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('room_participants')
        .select('*, profiles (username)')
        .eq('room_id', roomId)
        .eq('is_active', true) as any;

      if (!error && data) {
        const participants = data.map((p: any) => ({
          id: p.id,
          username: p.profiles?.username || 'Unknown',
          user_id: p.user_id,
          is_active: p.is_active,
        }));
        setParticipants(participants);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('room_chat_messages')
        .select('*, profiles (username)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true }) as any;

      if (!error && data) {
        const msgs = data.map((m: any) => ({
          id: m.id,
          username: m.profiles?.username || 'Unknown',
          content: m.content,
          created_at: m.created_at,
        }));
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const initializeLocalStream = async () => {
    try {
      // Optimized constraints for lowest latency
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }

      toast({
        title: 'Success',
        description: 'Camera and microphone connected',
      });

      // Update audio/video state based on stream tracks
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack) {
        audioTrack.enabled = isAudioOn;
        if ('contentHint' in audioTrack) {
          (audioTrack as any).contentHint = 'speech';
        }
      }
      if (videoTrack) {
        videoTrack.enabled = isVideoOn;
        if ('contentHint' in videoTrack) {
          (videoTrack as any).contentHint = 'motion';
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to access camera/microphone. Please check your browser permissions.',
        variant: 'destructive',
      });
      console.error('Error accessing media devices:', err);
    }
  };

  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
        setIsAudioOn(!isAudioOn);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
      }
    }
  };

  const handleLeaveRoom = async () => {
    try {
      // Stop all media tracks first
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      
      // Delete participant record (this removes them from the room)
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .eq('user_id', user?.id)
        .eq('room_id', roomId);

      if (error) throw error;
      
      navigate('/study-rooms');
    } catch (err) {
      console.error('Error leaving room:', err);
      toast({
        title: 'Error',
        description: 'Failed to leave room',
        variant: 'destructive',
      });
      // Navigate anyway even if delete fails
      setTimeout(() => navigate('/study-rooms'), 500);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      await supabase
        .from('room_chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          content: newMessage.trim(),
        });

      setNewMessage('');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  // Optimized WebRTC functions for lowest latency peer connections
  const createPeerConnection = async (participantUserId: string, participantUsername: string) => {
    if (!localStreamRef.current || !user) return;

    console.log('Creating peer connection with:', participantUsername, participantUserId);

    try {
      const pc = new RTCPeerConnection(rtcConfiguration);
      const peerConnection: PeerConnection = {
        peerConnection: pc,
        stream: null,
      };

      // Add local stream tracks to peer connection
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate to:', participantUserId);
          sendSignal(participantUserId, 'ice-candidate', event.candidate.toJSON());
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind, 'from:', participantUserId);
        
        if (event.streams && event.streams[0]) {
          peerConnection.stream = event.streams[0];
          
          // Update video element if it exists
          const videoElement = remoteVideosRef.current.get(participantUserId);
          if (videoElement) {
            videoElement.srcObject = event.streams[0];
            videoElement.play().catch(err => console.error('Error playing remote video:', err));
          }
        }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${participantUsername}:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          toast({
            title: 'Connected',
            description: `Connected to ${participantUsername}`,
          });
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('Connection failed/disconnected, will retry...');
          // Attempt to reconnect
          setTimeout(() => {
            if (peerConnectionsRef.current.has(participantUserId)) {
              closePeerConnection(participantUserId);
              createPeerConnection(participantUserId, participantUsername);
            }
          }, 2000);
        }
      };

      // ICE connection state monitoring
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${participantUsername}:`, pc.iceConnectionState);
      };

      peerConnectionsRef.current.set(participantUserId, peerConnection);

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      
      console.log('Sending offer to:', participantUserId);
      await sendSignal(participantUserId, 'offer', offer);

      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      toast({
        title: 'Connection Error',
        description: `Failed to connect to ${participantUsername}`,
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    if (!localStreamRef.current || !user) return;

    console.log('Handling offer from:', fromUserId);

    try {
      let peerConnection = peerConnectionsRef.current.get(fromUserId);
      
      if (!peerConnection) {
        // Create new peer connection
        const pc = new RTCPeerConnection(rtcConfiguration);
        peerConnection = {
          peerConnection: pc,
          stream: null,
        };

        // Add local stream tracks
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate to:', fromUserId);
            sendSignal(fromUserId, 'ice-candidate', event.candidate.toJSON());
          }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
          console.log('Received remote track from offer handler:', event.track.kind);
          
          if (event.streams && event.streams[0]) {
            peerConnection!.stream = event.streams[0];
            
            const videoElement = remoteVideosRef.current.get(fromUserId);
            if (videoElement) {
              videoElement.srcObject = event.streams[0];
              videoElement.play().catch(err => console.error('Error playing remote video:', err));
            }
          }
        };

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
          console.log(`Connection state with ${fromUserId}:`, pc.connectionState);
        };

        peerConnectionsRef.current.set(fromUserId, peerConnection);
      }

      await peerConnection.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.peerConnection.createAnswer();
      await peerConnection.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer to:', fromUserId);
      await sendSignal(fromUserId, 'answer', answer);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    console.log('Handling answer from:', fromUserId);

    try {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      
      if (peerConnection) {
        await peerConnection.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    console.log('Handling ICE candidate from:', fromUserId);

    try {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      
      if (peerConnection && peerConnection.peerConnection.remoteDescription) {
        await peerConnection.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  };

  const closePeerConnection = (userId: string) => {
    const peerConnection = peerConnectionsRef.current.get(userId);
    if (peerConnection) {
      peerConnection.peerConnection.close();
      peerConnectionsRef.current.delete(userId);
      
      // Remove video element reference
      remoteVideosRef.current.delete(userId);
    }
  };

  const handleCopyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      toast({
        title: 'Copied',
        description: 'Room code copied to clipboard',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <p className="text-red-500">Room not found</p>
        <Button onClick={() => navigate('/study-rooms')}>Go back</Button>
      </div>
    );
  }

  const getGlassmorphismClasses = () => {
    return 'bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl';
  };

  return (
    <div 
      className="h-screen flex flex-col gap-4 p-4 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('/background.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className={`flex items-center justify-between p-4 ${getGlassmorphismClasses()} shadow-lg`}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/study-rooms')}
            className="hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{room.room_name}</h1>
            <Badge variant="outline" className="mt-1 bg-white/10 border-white/20">{room.room_code}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyRoomCode}
            className="gap-2 bg-white/10 border-white/20 hover:bg-white/20"
          >
            <Copy className="h-4 w-4" />
            Copy Code
          </Button>
          <Button
            onClick={handleLeaveRoom}
            className="gap-2 bg-red-500/80 hover:bg-red-600/80 text-white"
          >
            <Phone className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Remote Videos Grid */}
          {participants.filter(p => p.user_id !== user?.id).length > 0 && (
            <div className={`flex-1 grid gap-4 overflow-auto ${
              participants.filter(p => p.user_id !== user?.id).length === 1 ? 'grid-cols-1' :
              participants.filter(p => p.user_id !== user?.id).length === 2 ? 'grid-cols-2' :
              participants.filter(p => p.user_id !== user?.id).length <= 4 ? 'grid-cols-2 grid-rows-2' :
              'grid-cols-3'
            }`}>
              {participants
                .filter(p => p.user_id !== user?.id)
                .map((participant) => (
                  <div
                    key={participant.user_id}
                    className={`relative overflow-hidden shadow-lg rounded-2xl bg-gray-900 ${getGlassmorphismClasses()}`}
                  >
                    <video
                      ref={(el) => {
                        if (el) {
                          remoteVideosRef.current.set(participant.user_id, el);
                          // If stream already exists, set it
                          const peerConn = peerConnectionsRef.current.get(participant.user_id);
                          if (peerConn?.stream) {
                            el.srcObject = peerConn.stream;
                            el.play().catch(err => console.error('Error playing video:', err));
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-semibold border border-white/20">
                      {participant.username}
                    </div>
                    <div className="absolute top-4 left-4 bg-green-500/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/20 flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      Live
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Local Video */}
          <div className={`${participants.filter(p => p.user_id !== user?.id).length > 0 ? 'h-48' : 'flex-1'} relative overflow-hidden shadow-lg ${getGlassmorphismClasses()}`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Video Status Badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/20">
              You {!isVideoOn && '(Camera Off)'}
            </div>

            {/* Control Buttons - Always Visible */}
            <div className="absolute bottom-4 right-4 flex gap-3">
              <Button
                size="lg"
                variant={isAudioOn ? 'default' : 'destructive'}
                onClick={handleToggleAudio}
                className={`rounded-full p-3 shadow-lg transition-all ${
                  isAudioOn
                    ? 'bg-green-500/80 hover:bg-green-600/80'
                    : 'bg-red-500/80 hover:bg-red-600/80'
                }`}
              >
                {isAudioOn ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>
              <Button
                size="lg"
                variant={isVideoOn ? 'default' : 'destructive'}
                onClick={handleToggleVideo}
                className={`rounded-full p-3 shadow-lg transition-all ${
                  isVideoOn
                    ? 'bg-blue-500/80 hover:bg-blue-600/80'
                    : 'bg-red-500/80 hover:bg-red-600/80'
                }`}
              >
                {isVideoOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-96 flex flex-col gap-4 overflow-hidden">
          {/* Participants */}
          <div className={`${getGlassmorphismClasses()} overflow-hidden flex flex-col shadow-lg`}>
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                Participants ({participants.length})
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 text-sm p-3 rounded-lg hover:bg-white/10 transition-colors bg-white/5"
                  >
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="font-medium">{p.username}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Chat */}
          <div className={`flex-1 ${getGlassmorphismClasses()} overflow-hidden flex flex-col shadow-lg`}>
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
              <h2 className="font-bold text-sm">Chat Messages</h2>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    No messages yet. Start chatting!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="text-xs bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="font-semibold text-accent mb-1">{msg.username}</div>
                      <div className="text-muted-foreground break-words">{msg.content}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-white/10 bg-gradient-to-t from-white/5 to-white/0 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="text-xs h-9 bg-white/10 border-white/20 hover:bg-white/15 focus:bg-white/20 text-foreground placeholder:text-muted-foreground"
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                className="px-3 bg-accent/80 hover:bg-accent text-accent-foreground"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
