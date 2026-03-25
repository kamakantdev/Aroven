'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useVideoConsultation, useConsultationChat, useConsultationEnded } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import DoctorVitalsPanel from '@/components/consultation/DoctorVitalsPanel';

import {
    Video,
    VideoOff,
    Mic,
    MicOff,
    Phone,
    MessageCircle,
    FileText,
    Users,
    Maximize,
    Minimize,
    Send,
    X,
    AlertCircle,
    Wifi,
    WifiOff,
    PhoneCall,
    Bot,
    Loader2,
    Pill,
    Stethoscope,
    FlaskConical,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

// ── ICE Servers with TURN fallback for NAT traversal ───────────────
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // TURN servers (env-configurable, with free fallback for dev)
        ...(process.env.NEXT_PUBLIC_TURN_URL
            ? [{
                urls: process.env.NEXT_PUBLIC_TURN_URL,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
            }]
            : [
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            ]),
    ],
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
};

// ── Network quality classification ─────────────────────────────────
type ConnectionMode = 'video' | 'audio' | 'chat';
interface NetworkStats { rtt: number; packetsLost: number; bitrate: number; quality: 'excellent' | 'good' | 'poor' | 'critical'; }

interface AIMedication { name: string; dosage: string; frequency: string; duration: string; notes: string; }
interface AIResponse {
    answer: string;
    alerts?: string[];
    possible_conditions?: string[];
    suggested_questions?: string[];
    summary?: string;
    clinical_notes?: string;
    risk_indicators?: string[];
    severity_assessment?: string;
    suggested_medications?: AIMedication[];
    differential_diagnoses?: string[];
    recommended_tests?: string[];
    vitals_interpretation?: string;
}

function classifyQuality(rtt: number, lossRate: number, bitrate: number): NetworkStats['quality'] {
    if (rtt < 150 && lossRate < 2 && bitrate > 500) return 'excellent';
    if (rtt < 300 && lossRate < 5 && bitrate > 200) return 'good';
    if (rtt < 600 && lossRate < 15 && bitrate > 50) return 'poor';
    return 'critical';
}

export default function VideoConsultation() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuthStore();
    const consultationId = params.id as string;

    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const prevBytesRef = useRef<number>(0);
    const prevTimestampRef = useRef<number>(0);
    const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const hasRemoteDescriptionRef = useRef<boolean>(false);

    // State
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [consultationData, setConsultationData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);

    // ── Network degradation state ──────────────────────────────────
    const [connectionMode, setConnectionMode] = useState<ConnectionMode>('video');
    const [networkStats, setNetworkStats] = useState<NetworkStats>({ rtt: 0, packetsLost: 0, bitrate: 0, quality: 'good' });
    const [modeBanner, setModeBanner] = useState<string | null>(null);

    // ── AI Clinical Assistant state (doctor only) ──────────────────
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState<{ query: string; response: AIResponse }[]>([]);
    const [aiExpanded, setAiExpanded] = useState<number | null>(null);

    // Socket hooks
    const {
        participants,
        offer,
        answer,
        iceCandidate,
        sendOffer,
        sendAnswer,
        sendIceCandidate,
    } = useVideoConsultation(consultationId);

    const { messages, sendMessage, setTyping, typingUsers } = useConsultationChat(consultationId);

    // Chat input state
    const [chatInput, setChatInput] = useState('');
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleChatInputChange = (value: string) => {
        setChatInput(value);
        setTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
    };

    // ── Remote call-ended detection ────────────────────────────────
    const [callEndedByRemote, setCallEndedByRemote] = useState(false);
    useConsultationEnded(
        useCallback((data: { consultationId: string }) => {
            if (data.consultationId === consultationId) {
                setCallEndedByRemote(true);
                cleanup();
                // Auto-redirect after 4 seconds
                setTimeout(() => {
                    router.push(user?.role === 'doctor' ? '/doctor/consultations' : '/');
                }, 4000);
            }
        }, [consultationId])
    );

    // Timer for call duration
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConnected) {
            interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isConnected]);

    // Initialize media and peer connection — calls join API first
    useEffect(() => {
        initializeCall();
        return () => { cleanup(); };
    }, [consultationId]);

    // Handle incoming WebRTC signaling
    useEffect(() => {
        if (offer && !peerConnectionRef.current?.currentRemoteDescription) {
            handleIncomingOffer(offer);
        }
    }, [offer]);

    useEffect(() => {
        if (answer && peerConnectionRef.current) {
            handleIncomingAnswer(answer);
        }
    }, [answer]);

    useEffect(() => {
        if (iceCandidate && peerConnectionRef.current) {
            handleIncomingIceCandidate(iceCandidate);
        }
    }, [iceCandidate]);

    // When remote user joins, initiate connection
    useEffect(() => {
        if (participants.length > 0 && !isConnected) {
            initiateCall();
        }
    }, [participants]);

    // ── Network quality monitoring ─────────────────────────────────
    useEffect(() => {
        if (!isConnected || !peerConnectionRef.current) return;
        statsIntervalRef.current = setInterval(async () => {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            try {
                const stats = await pc.getStats();
                let totalPacketsLost = 0, totalPacketsReceived = 0, currentRtt = 0, bytesReceived = 0, timestamp = 0;
                stats.forEach((report: any) => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        currentRtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
                    }
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        totalPacketsLost += report.packetsLost || 0;
                        totalPacketsReceived += report.packetsReceived || 0;
                        bytesReceived = report.bytesReceived || 0;
                        timestamp = report.timestamp;
                    }
                });
                const lossRate = totalPacketsReceived > 0 ? (totalPacketsLost / (totalPacketsReceived + totalPacketsLost)) * 100 : 0;
                let bitrate = 0;
                if (prevBytesRef.current > 0 && prevTimestampRef.current > 0) {
                    const timeDiff = (timestamp - prevTimestampRef.current) / 1000;
                    if (timeDiff > 0) bitrate = ((bytesReceived - prevBytesRef.current) * 8) / timeDiff / 1000;
                }
                prevBytesRef.current = bytesReceived;
                prevTimestampRef.current = timestamp;
                const quality = classifyQuality(currentRtt, lossRate, bitrate);
                setNetworkStats({ rtt: Math.round(currentRtt), packetsLost: totalPacketsLost, bitrate: Math.round(bitrate), quality });
                handleQualityChange(quality);
            } catch { /* stats unavailable */ }
        }, 3000);
        return () => { if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); };
    }, [isConnected]);

    // ── Auto-degrade / upgrade mode based on quality ───────────────
    const handleQualityChange = useCallback((quality: NetworkStats['quality']) => {
        if (quality === 'critical' && connectionMode !== 'chat') {
            localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
            localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
            setIsVideoOn(false); setIsMuted(true);
            setConnectionMode('chat'); setShowChat(true);
            setModeBanner('⚠️ Very poor network — switched to Chat mode');
            setTimeout(() => setModeBanner(null), 5000);
        } else if (quality === 'poor' && connectionMode === 'video') {
            localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
            setIsVideoOn(false); setConnectionMode('audio');
            setModeBanner('📶 Low bandwidth — switched to Audio-only mode');
            setTimeout(() => setModeBanner(null), 5000);
        } else if ((quality === 'excellent' || quality === 'good') && connectionMode === 'audio') {
            localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = true; });
            setIsVideoOn(true); setConnectionMode('video');
            setModeBanner('✅ Network improved — Video restored');
            setTimeout(() => setModeBanner(null), 3000);
        } else if ((quality === 'excellent' || quality === 'good') && connectionMode === 'chat') {
            localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
            localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = true; });
            setIsVideoOn(true); setIsMuted(false); setConnectionMode('video');
            setModeBanner('✅ Network recovered — Video restored');
            setTimeout(() => setModeBanner(null), 3000);
        }
    }, [connectionMode]);

    // ── Initialization: join API → media → peer connection ─────────
    const initializeCall = async () => {
        try {
            // Call join API to authorize participant
            const joinRes = await api.consultations.join(consultationId);
            if (joinRes.success && joinRes.data) setConsultationData(joinRes.data);
            else {
                const detailRes = await api.consultations.getDetails(consultationId);
                if (detailRes.success) setConsultationData(detailRes.data);
            }
        } catch {
            // Fallback — try details only
            try { const d = await api.consultations.getDetails(consultationId); if (d.success) setConsultationData(d.data); } catch {}
        }
        await initializeMedia();
    };

    const fetchConsultationData = async () => {
        try {
            const response = await api.consultations.getDetails(consultationId);
            if (response.success) {
                setConsultationData(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch consultation:', err);
        }
    };

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setupPeerConnection();
            setIsConnecting(false);
        } catch (err) {
            console.error('Media access error:', err);
            // Try audio-only if camera fails
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                localStreamRef.current = audioStream;
                setIsVideoOn(false); setConnectionMode('audio');
                setupPeerConnection();
                setIsConnecting(false);
                setModeBanner('📷 Camera unavailable — Audio-only mode');
                setTimeout(() => setModeBanner(null), 4000);
            } catch {
                setError('Failed to access camera and microphone. Please check permissions.');
                setIsConnecting(false);
                setConnectionMode('chat'); setShowChat(true);
            }
        }
    };

    const setupPeerConnection = () => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle remote stream
        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setIsConnected(true);
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendIceCandidate(event.candidate.toJSON());
            }
        };

        // Connection state changes — with reconnection handling
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === 'connected') {
                setIsConnected(true);
            } else if (state === 'disconnected') {
                setModeBanner('⚠️ Connection interrupted — reconnecting...');
                setTimeout(() => setModeBanner(null), 5000);
            } else if (state === 'failed') {
                setIsConnected(false);
                setConnectionMode('chat'); setShowChat(true);
                setModeBanner('❌ Connection lost — switched to Chat mode');
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed') pc.restartIce();
        };
    };

    const initiateCall = async () => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            const offerDescription = await pc.createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
            });

            await pc.setLocalDescription(offerDescription);
            sendOffer(offerDescription);
        } catch (err) {
            console.error('Failed to create offer:', err);
            setError('Failed to initiate call');
        }
    };

    const handleIncomingOffer = async (offerData: RTCSessionDescriptionInit) => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(offerData));
            hasRemoteDescriptionRef.current = true;

            // Drain buffered ICE candidates
            for (const candidate of pendingIceCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceCandidatesRef.current = [];

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            sendAnswer(answerDescription);
        } catch (err) {
            console.error('Failed to handle offer:', err);
        }
    };

    const handleIncomingAnswer = async (answerData: RTCSessionDescriptionInit) => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc || pc.currentRemoteDescription) return;

            await pc.setRemoteDescription(new RTCSessionDescription(answerData));
            hasRemoteDescriptionRef.current = true;

            // Drain buffered ICE candidates
            for (const candidate of pendingIceCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceCandidatesRef.current = [];
        } catch (err) {
            console.error('Failed to handle answer:', err);
        }
    };

    const handleIncomingIceCandidate = async (candidate: RTCIceCandidateInit) => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            // Buffer ICE candidates until remote description is set
            if (!hasRemoteDescriptionRef.current) {
                pendingIceCandidatesRef.current.push(candidate);
                return;
            }

            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('Failed to add ICE candidate:', err);
        }
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (connectionMode === 'chat') return;
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOn(videoTrack.enabled);
                setConnectionMode(videoTrack.enabled ? 'video' : 'audio');
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const endCall = async () => {
        try {
            if (user?.role === 'doctor') {
                await api.consultations.end(consultationId, {
                    duration: callDuration,
                    notes: '',
                });
            } else {
                // Patients leave — they can't end the consultation
                await api.consultations.leave(consultationId).catch(() => {});
            }
        } catch (err) {
            console.error('Failed to end/leave consultation:', err);
        } finally {
            cleanup();
            router.push(user?.role === 'doctor' ? '/doctor/consultations' : '/');
        }
    };

    const cleanup = () => {
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        // Stop all local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Reset ICE buffer
        hasRemoteDescriptionRef.current = false;
        pendingIceCandidatesRef.current = [];
    };

    const handleSendMessage = () => {
        if (chatInput.trim()) {
            sendMessage(chatInput.trim());
            setChatInput('');
            setTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    // ── AI Clinical Assistant handler ──────────────────────────────
    const handleAIQuery = async () => {
        if (!aiQuery.trim() || aiLoading) return;
        const query = aiQuery.trim();
        setAiQuery('');
        setAiLoading(true);
        try {
            const result = await api.consultations.aiAssist(consultationId, query, consultationData?.diagnosis || '') as any;
            if (result.success && result.data) {
                const response: AIResponse = result.data.response || { answer: 'No response received' };
                setAiHistory(prev => [...prev, { query, response }]);
                setAiExpanded(aiHistory.length); // expand latest
            }
        } catch (err) {
            setAiHistory(prev => [...prev, { query, response: { answer: '⚠️ AI assistant temporarily unavailable. Please try again.' } }]);
        } finally {
            setAiLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-screen bg-gray-900 flex flex-col">
            {/* ── Remote call-ended overlay ──────────────────────────── */}
            {callEndedByRemote && (
                <div className="absolute inset-0 z-50 bg-gray-900/90 flex flex-col items-center justify-center gap-4">
                    <Phone className="h-16 w-16 text-red-400 rotate-[135deg]" />
                    <h2 className="text-2xl font-bold text-white">Call Ended</h2>
                    <p className="text-gray-400">The other participant has ended the consultation.</p>
                    <p className="text-gray-500 text-sm">Redirecting in a few seconds…</p>
                    <button
                        onClick={() => router.push(user?.role === 'doctor' ? '/doctor/consultations' : '/')}
                        className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Go Back Now
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="bg-gray-800/80 backdrop-blur-lg border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                        <span className="text-white font-medium">
                            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Waiting'}
                        </span>
                    </div>
                    {isConnected && (
                        <>
                            <span className="text-gray-400 text-sm bg-gray-700/50 px-3 py-1 rounded-full">
                                {formatDuration(callDuration)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${connectionMode === 'video' ? 'bg-green-500/20 text-green-400' : connectionMode === 'audio' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {connectionMode === 'video' ? 'Video' : connectionMode === 'audio' ? '🎤 Audio Only' : '💬 Chat Only'}
                            </span>
                            <span className={`text-xs ${networkStats.quality === 'excellent' || networkStats.quality === 'good' ? 'text-green-400' : networkStats.quality === 'poor' ? 'text-yellow-400' : 'text-red-400'}`}>
                                {networkStats.quality === 'critical' ? <WifiOff className="w-4 h-4 inline" /> : <Wifi className="w-4 h-4 inline" />}
                            </span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {consultationData && (
                        <span className="text-gray-400 text-sm">
                            {user?.role === 'doctor'
                                ? `Patient: ${consultationData.patient?.name}`
                                : `Dr. ${consultationData.doctor?.name}`}
                        </span>
                    )}
                </div>
            </header>

            {/* Main Video Area */}
            {modeBanner && (
                <div className="bg-yellow-500/90 text-black text-center py-2 text-sm font-medium animate-pulse">
                    {modeBanner}
                </div>
            )}
            <div className={`flex-1 flex overflow-hidden ${showAIPanel ? '' : ''}`}>
            <div className="flex-1 relative overflow-hidden">
                {error && connectionMode !== 'chat' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
                            <p className="text-gray-400 mb-4">{error}</p>
                            <button
                                onClick={() => router.back()}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                ) : connectionMode === 'chat' ? (
                    /* ── Full-screen Chat Mode ─────────────────────── */
                    <div className="flex flex-col h-full bg-gray-800">
                        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                            <MessageCircle className="w-5 h-5 text-blue-400" />
                            <h3 className="font-semibold text-white">Chat Consultation</h3>
                            <span className="text-xs text-gray-400">(Poor network — media disabled)</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && <p className="text-center text-gray-500 mt-8">Send a message to continue the consultation</p>}
                            {messages.map((msg, index) => (
                                <div key={index} className={`max-w-[80%] p-3 rounded-xl ${msg.userId === user?.id ? 'ml-auto bg-blue-500 text-white' : 'bg-gray-700 text-white'}`}>
                                    <p className="text-sm">{msg.message}</p>
                                    <p className="text-xs opacity-60 mt-1">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                </div>
                            ))}
                        </div>
                        {typingUsers.length > 0 && (
                            <div className="px-4 py-2 border-t border-gray-700/50">
                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                    <span className="flex gap-0.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></span>
                                    <span>Someone is typing…</span>
                                </div>
                            </div>
                        )}
                        <div className="p-4 border-t border-gray-700">
                            <div className="flex items-center gap-2">
                                <input type="text" value={chatInput} onChange={(e) => handleChatInputChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type a message..." className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                                <button onClick={handleSendMessage} className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"><Send className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Remote Video / Audio-only placeholder */}
                        {connectionMode === 'audio' ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="text-center">
                                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                                        <PhoneCall className="w-14 h-14 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white mb-1">Audio Consultation</h2>
                                    <p className="text-gray-400 text-sm">Low bandwidth — video disabled</p>
                                    {isConnected && <p className="text-emerald-400 text-sm mt-2">{formatDuration(callDuration)}</p>}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Remote Video (Large) */}
                                <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* Placeholder when no remote video */}
                        {!isConnected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="text-center">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                                        <Users className="w-12 h-12 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white mb-2">
                                        {isConnecting ? 'Setting up...' : 'Waiting for participant'}
                                    </h2>
                                    <p className="text-gray-400">The consultation will begin shortly</p>
                                </div>
                            </div>
                        )}
                            </>
                        )}

                        {/* Local Video (Small/PIP) */}
                        <div className="absolute bottom-24 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${!isVideoOn && 'hidden'}`}
                            />
                            {!isVideoOn && (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                    {connectionMode === 'audio' ? <Mic className="w-8 h-8 text-emerald-500" /> : <VideoOff className="w-8 h-8 text-gray-500" />}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Chat Panel (side panel — only in video/audio mode) */}
                {showChat && connectionMode !== 'chat' && (
                    <div className="absolute right-0 top-0 bottom-20 w-80 bg-gray-800/95 backdrop-blur-lg border-l border-gray-700 flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Chat</h3>
                            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`max-w-[80%] p-3 rounded-xl ${msg.userId === user?.id
                                            ? 'ml-auto bg-blue-500 text-white'
                                            : 'bg-gray-700 text-white'
                                        }`}
                                >
                                    <p className="text-sm">{msg.message}</p>
                                </div>
                            ))}
                        </div>

                        {typingUsers.length > 0 && (
                            <div className="px-4 py-2 border-t border-gray-700/50">
                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                    <span className="flex gap-0.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></span>
                                    <span>Someone is typing…</span>
                                </div>
                            </div>
                        )}
                        <div className="p-4 border-t border-gray-700">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => handleChatInputChange(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── AI Clinical Assistant Panel (doctor only) ────────── */}
                {showAIPanel && user?.role === 'doctor' && (
                    <div className={`absolute ${showChat && connectionMode !== 'chat' ? 'right-80' : 'right-0'} top-0 bottom-20 w-96 bg-gray-900/95 backdrop-blur-lg border-l border-purple-700/50 flex flex-col`}>
                        <div className="p-4 border-b border-purple-700/50 flex items-center justify-between bg-gradient-to-r from-purple-900/50 to-gray-900">
                            <div className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-purple-400" />
                                <h3 className="font-semibold text-white">AI Clinical Assistant</h3>
                            </div>
                            <button onClick={() => setShowAIPanel(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        {/* AI Quick Prompts */}
                        <div className="p-3 border-b border-gray-700/50 flex flex-wrap gap-2">
                            {['Suggest medications', 'Drug interactions check', 'Differential diagnosis', 'Recommend lab tests'].map((prompt) => (
                                <button key={prompt} onClick={() => { setAiQuery(prompt); }} className="text-xs px-2.5 py-1.5 rounded-full bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors border border-purple-500/30">
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* AI Conversation History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {aiHistory.length === 0 && (
                                <div className="text-center py-8">
                                    <Bot className="w-12 h-12 text-purple-400/50 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm">Ask about medications, drug interactions,<br />differential diagnoses, or treatment protocols</p>
                                    <p className="text-gray-500 text-xs mt-2">Responses are for clinical reference only</p>
                                </div>
                            )}
                            {aiHistory.map((entry, idx) => (
                                <div key={idx} className="space-y-2">
                                    {/* Doctor query */}
                                    <div className="ml-auto max-w-[85%] p-3 rounded-xl bg-purple-600/30 text-purple-100 text-sm border border-purple-500/30">
                                        {entry.query}
                                    </div>
                                    {/* AI response */}
                                    <div className="max-w-[95%] rounded-xl bg-gray-800 border border-gray-700 overflow-hidden">
                                        <div className="p-3">
                                            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{entry.response.answer}</p>
                                        </div>
                                        {/* Expandable sections */}
                                        {(entry.response.suggested_medications?.length || entry.response.differential_diagnoses?.length || entry.response.recommended_tests?.length) && (
                                            <div className="border-t border-gray-700">
                                                <button onClick={() => setAiExpanded(aiExpanded === idx ? null : idx)} className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-400 hover:bg-gray-700/50">
                                                    <span>Clinical details</span>
                                                    {aiExpanded === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                                {aiExpanded === idx && (
                                                    <div className="px-3 pb-3 space-y-3">
                                                        {/* Medications */}
                                                        {entry.response.suggested_medications && entry.response.suggested_medications.length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 mb-1.5"><Pill className="w-3.5 h-3.5 text-green-400" /><span className="text-xs font-medium text-green-400">Suggested Medications</span></div>
                                                                <div className="space-y-1.5">
                                                                    {entry.response.suggested_medications.map((med, mi) => (
                                                                        <div key={mi} className="bg-gray-700/50 rounded-lg p-2 text-xs">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-medium text-white">{med.name}</span>
                                                                                <span className="text-gray-400">{med.dosage}</span>
                                                                            </div>
                                                                            <p className="text-gray-400 mt-0.5">{med.frequency} × {med.duration}</p>
                                                                            {med.notes && <p className="text-yellow-400/80 mt-1 text-[11px]">⚠️ {med.notes}</p>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Differential Diagnoses */}
                                                        {entry.response.differential_diagnoses && entry.response.differential_diagnoses.length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 mb-1.5"><Stethoscope className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs font-medium text-blue-400">Differential Diagnoses</span></div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {entry.response.differential_diagnoses.map((dx, di) => (
                                                                        <span key={di} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md border border-blue-500/30">{dx}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Recommended Tests */}
                                                        {entry.response.recommended_tests && entry.response.recommended_tests.length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 mb-1.5"><FlaskConical className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs font-medium text-amber-400">Recommended Tests</span></div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {entry.response.recommended_tests.map((test, ti) => (
                                                                        <span key={ti} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-md border border-amber-500/30">{test}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Severity */}
                                                        {entry.response.severity_assessment && (
                                                            <p className="text-xs"><span className="text-gray-400">Severity: </span><span className={`font-medium ${entry.response.severity_assessment === 'severe' ? 'text-red-400' : entry.response.severity_assessment === 'moderate' ? 'text-yellow-400' : 'text-green-400'}`}>{entry.response.severity_assessment}</span></p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {aiLoading && (
                                <div className="flex items-center gap-2 text-purple-300 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</div>
                            )}
                        </div>

                        {/* AI Input */}
                        <div className="p-3 border-t border-purple-700/50 bg-gray-900">
                            <div className="flex items-center gap-2">
                                <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAIQuery()} placeholder="Ask about medications, interactions..." className="flex-1 bg-gray-800 border border-purple-500/30 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" disabled={aiLoading} />
                                <button onClick={handleAIQuery} disabled={aiLoading || !aiQuery.trim()} className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5 text-center">AI suggestions are for clinical reference — verify before prescribing</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Doctor Vitals + AI Side Panel */}
            {showAIPanel && user?.role === 'doctor' && (
                <DoctorVitalsPanel consultationId={consultationId} isDoctor={user?.role === 'doctor'} />
            )}
            </div>

            {/* Controls Bar */}
            {connectionMode !== 'chat' ? (
            <div className="bg-gray-800/80 backdrop-blur-lg border-t border-gray-700 px-4 py-4">
                <div className="flex items-center justify-center gap-4">
                    {/* Mute Button */}
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                    >
                        {isMuted ? (
                            <MicOff className="w-6 h-6 text-white" />
                        ) : (
                            <Mic className="w-6 h-6 text-white" />
                        )}
                    </button>

                    {/* Video Toggle */}
                    <button
                        onClick={toggleVideo}
                        className={`p-4 rounded-full transition-colors ${!isVideoOn ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                    >
                        {!isVideoOn ? (
                            <VideoOff className="w-6 h-6 text-white" />
                        ) : (
                            <Video className="w-6 h-6 text-white" />
                        )}
                    </button>

                    {/* End Call */}
                    <button
                        onClick={endCall}
                        className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                    >
                        <Phone className="w-6 h-6 text-white rotate-[135deg]" />
                    </button>

                    {/* Chat Toggle */}
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className={`p-4 rounded-full transition-colors ${showChat ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                    >
                        <MessageCircle className="w-6 h-6 text-white" />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                    >
                        {isFullscreen ? (
                            <Minimize className="w-6 h-6 text-white" />
                        ) : (
                            <Maximize className="w-6 h-6 text-white" />
                        )}
                    </button>

                    {/* Prescription (Doctor only) */}
                    {user?.role === 'doctor' && (
                        <button
                            onClick={() => router.push(`/doctor/prescriptions/new?consultation=${consultationId}`)}
                            className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                            title="Create Prescription"
                        >
                            <FileText className="w-6 h-6 text-white" />
                        </button>
                    )}

                    {/* AI Clinical Assistant (Doctor only) */}
                    {user?.role === 'doctor' && (
                        <button
                            onClick={() => setShowAIPanel(!showAIPanel)}
                            className={`p-4 rounded-full transition-colors ${showAIPanel ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                            title="AI Clinical Assistant"
                        >
                            <Bot className="w-6 h-6 text-white" />
                        </button>
                    )}
                </div>
            </div>
            ) : (
                /* Chat-mode end call bar */
                <div className="bg-gray-800/80 backdrop-blur-lg border-t border-gray-700 px-4 py-3 flex items-center justify-center gap-4">
                    <button onClick={endCall} className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full text-white font-medium">
                        <Phone className="w-5 h-5 rotate-[135deg]" /> End Consultation
                    </button>
                    {user?.role === 'doctor' && (
                        <button onClick={() => router.push(`/doctor/prescriptions/new?consultation=${consultationId}`)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-full text-white font-medium">
                            <FileText className="w-5 h-5" /> Write Prescription
                        </button>
                    )}
                    {user?.role === 'doctor' && (
                        <button onClick={() => setShowAIPanel(!showAIPanel)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium ${showAIPanel ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                            <Bot className="w-5 h-5" /> AI Assist
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
