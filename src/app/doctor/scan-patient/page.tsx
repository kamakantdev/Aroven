'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ScanLine, Camera, ArrowLeft, Loader2, AlertTriangle,
    CheckCircle, Keyboard, ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export default function ScanPatientQRPage() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationRef = useRef<number>(0);

    const [mode, setMode] = useState<'camera' | 'manual'>('camera');
    const [manualToken, setManualToken] = useState('');
    const [scanning, setScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [validating, setValidating] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; token?: string } | null>(null);

    // Start camera
    useEffect(() => {
        if (mode !== 'camera') return;
        let cancelled = false;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setScanning(true);
                    scanFrame();
                }
            } catch (err: any) {
                if (!cancelled) {
                    setCameraError(
                        err.name === 'NotAllowedError' ? 'Camera access denied. Please allow camera permission or use manual entry.' :
                        err.name === 'NotFoundError' ? 'No camera found. Use manual entry instead.' :
                        `Camera error: ${err.message}`
                    );
                }
            }
        };

        startCamera();

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            setScanning(false);
        };
    }, [mode]);

    // Frame-by-frame QR scanning using BarcodeDetector API
    const scanFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        // Check if BarcodeDetector is available
        if (!('BarcodeDetector' in window)) {
            setCameraError('QR scanning not supported in this browser. Please use manual entry or try Chrome/Edge.');
            return;
        }

        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

        const loop = async () => {
            if (!videoRef.current || videoRef.current.readyState !== 4) {
                animationRef.current = requestAnimationFrame(loop);
                return;
            }

            try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    const url = barcodes[0].rawValue;
                    // Extract token from URL like https://domain/health-card/TOKEN
                    const tokenMatch = String(url || '').match(/health-card\/([a-f0-9]{64})/i);
                    if (tokenMatch) {
                        // Stop scanning
                        if (streamRef.current) {
                            streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                        }
                        setScanning(false);
                        await validateAndNavigate(tokenMatch[1]);
                        return;
                    }
                }
            } catch {
                // Ignore detection errors, keep scanning
            }

            animationRef.current = requestAnimationFrame(loop);
        };

        loop();
    };

    // Validate token and navigate
    const validateAndNavigate = async (token: string) => {
        setValidating(true);
        setResult(null);
        try {
            const res = await fetch(`${API_BASE_URL}/health-card/${token}`);
            const data = await res.json();
            if (res.ok && data.success) {
                setResult({ success: true, message: `Patient: ${data.data.patient.name}`, token });
                // Auto-navigate after 1 second
                setTimeout(() => {
                    window.open(`/health-card/${token}`, '_blank');
                }, 1000);
            } else {
                setResult({ success: false, message: data.message || 'Invalid or expired health card' });
            }
        } catch {
            setResult({ success: false, message: 'Failed to validate health card. Check your connection.' });
        }
        setValidating(false);
    };

    const handleManualSubmit = () => {
        const token = manualToken.trim();
        // Try to extract token from a full URL or raw token
        const decoded = (() => {
            try { return decodeURIComponent(token); } catch { return token; }
        })();
        const urlMatch = decoded.match(/health-card\/([a-f0-9]{64})/i);
        const rawMatch = decoded.match(/^[a-f0-9]{64}$/i);
        const extracted = (urlMatch?.[1] || (rawMatch ? decoded : null))?.toLowerCase();
        if (extracted) {
            validateAndNavigate(extracted);
        } else {
            setResult({ success: false, message: 'Invalid token. Paste the full URL or 64-character token.' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📱 Scan Patient QR</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Scan a patient&apos;s health card QR to view their complete medical records</p>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                <Button variant={mode === 'camera' ? 'primary' : 'outline'} size="sm"
                    onClick={() => { setMode('camera'); setResult(null); setCameraError(null); }}>
                    <Camera className="h-4 w-4 mr-1" /> Camera Scanner
                </Button>
                <Button variant={mode === 'manual' ? 'primary' : 'outline'} size="sm"
                    onClick={() => { setMode('manual'); setResult(null); }}>
                    <Keyboard className="h-4 w-4 mr-1" /> Manual Entry
                </Button>
            </div>

            {/* Camera Mode */}
            {mode === 'camera' && (
                <Card>
                    <CardContent>
                        {cameraError ? (
                            <div className="text-center py-12">
                                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                                <p className="text-gray-700 dark:text-gray-300 mb-4">{cameraError}</p>
                                <Button variant="outline" onClick={() => setMode('manual')}>
                                    <Keyboard className="h-4 w-4 mr-1" /> Use Manual Entry
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <video ref={videoRef} className="w-full max-h-[400px] rounded-xl bg-black object-cover" playsInline muted />
                                <canvas ref={canvasRef} className="hidden" />
                                {scanning && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-48 h-48 border-2 border-purple-400 rounded-2xl relative">
                                            <ScanLine className="absolute inset-0 m-auto h-6 w-6 text-purple-400 animate-pulse" />
                                            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
                                            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
                                            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
                                        </div>
                                    </div>
                                )}
                                {scanning && (
                                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">Point the camera at the patient&apos;s health card QR code</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Manual Mode */}
            {mode === 'manual' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Enter Health Card Token</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Paste the health card URL or token shared by the patient
                        </p>
                        <div className="flex gap-2">
                            <input type="text" value={manualToken} onChange={e => setManualToken(e.target.value)}
                                placeholder="https://swastik.health/health-card/abc123... or token"
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                            />
                            <Button onClick={handleManualSubmit} disabled={!manualToken.trim() || validating}>
                                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View Records'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Result */}
            {validating && (
                <Card>
                    <CardContent>
                        <div className="flex items-center justify-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                            <span className="text-gray-600 dark:text-gray-400">Validating health card...</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {result && (
                <Card className={result.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
                    <CardContent>
                        <div className="flex items-center gap-3 py-2">
                            {result.success ? (
                                <>
                                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-medium text-green-800">{result.message}</p>
                                        <p className="text-sm text-green-600 mt-1">Opening health record...</p>
                                    </div>
                                    {result.token && (
                                        <Button size="sm" variant="outline"
                                            onClick={() => window.open(`/health-card/${result.token}`, '_blank')}>
                                            <ExternalLink className="h-4 w-4 mr-1" /> Open
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-red-800">{result.message}</p>
                                        <p className="text-sm text-red-600 mt-1">Ask the patient to generate a new QR code from their app.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Instructions */}
            <Card>
                <CardContent>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">How it works</h3>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <p>1️⃣ Patient opens the Swastik app → Profile → taps <strong>&quot;Health QR Code&quot;</strong></p>
                        <p>2️⃣ Patient shows the QR code on their phone screen</p>
                        <p>3️⃣ You scan it here or use any phone camera to scan the QR</p>
                        <p>4️⃣ Complete medical records open instantly — prescriptions, reports, vitals, allergies</p>
                        <p className="text-xs text-gray-400 mt-3">🔒 Health cards are time-limited (24h) and patient-controlled. The patient can revoke access anytime.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
