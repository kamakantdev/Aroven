'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, Loader2, X, Upload } from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProfileImageUploadProps {
    currentImage?: string | null;
    name: string;
    onUploadComplete: (url: string) => void;
    size?: 'sm' | 'md' | 'lg';
    accentColor?: string; // e.g. 'emerald', 'teal', 'pink'
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map(p => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export function ProfileImageUpload({
    currentImage,
    name,
    onUploadComplete,
    size = 'md',
    accentColor = 'emerald',
}: ProfileImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentImage || null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sizeClasses = {
        sm: 'h-16 w-16 text-lg',
        md: 'h-24 w-24 text-xl',
        lg: 'h-32 w-32 text-2xl',
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
            setError('Please upload a JPEG, PNG, WebP, or GIF image.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5 MB.');
            return;
        }

        setError(null);

        // Local preview
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);

        // Upload
        setUploading(true);
        try {
            const result = await uploadApi.uploadFile(file, 'profile');
            if (result.success && result.data) {
                const data = result.data as Record<string, unknown>;
                const url = (data.url || data.fileUrl || data.file_url || '') as string;
                if (url) {
                    onUploadComplete(url);
                } else {
                    setError('Upload succeeded but no URL returned.');
                }
            } else {
                setError(result.error || 'Upload failed.');
                setPreview(currentImage || null);
            }
        } catch {
            setError('Upload failed. Please try again.');
            setPreview(currentImage || null);
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Tailwind CSS purges dynamic class names — use a pre-computed mapping.
    const accentMap: Record<string, { bg: string; text: string }> = {
        emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
        teal:    { bg: 'bg-teal-100',    text: 'text-teal-700' },
        pink:    { bg: 'bg-pink-100',    text: 'text-pink-700' },
        blue:    { bg: 'bg-blue-100',    text: 'text-blue-700' },
        purple:  { bg: 'bg-purple-100',  text: 'text-purple-700' },
        orange:  { bg: 'bg-orange-100',  text: 'text-orange-700' },
        red:     { bg: 'bg-red-100',     text: 'text-red-700' },
        amber:   { bg: 'bg-amber-100',   text: 'text-amber-700' },
        cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700' },
    };
    const accent = accentMap[accentColor] || accentMap.emerald;
    const bgColor = accent.bg;
    const textColor = accent.text;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative group">
                {/* Avatar / Preview */}
                <div className={cn(
                    'rounded-full overflow-hidden flex items-center justify-center font-bold relative',
                    sizeClasses[size],
                    !preview && bgColor,
                    !preview && textColor,
                )}>
                    {preview ? (
                        <Image
                            src={preview}
                            alt={name}
                            fill
                            sizes="(max-width: 768px) 96px, 128px"
                            className="object-cover"
                            loading="lazy"
                            unoptimized={preview.startsWith('data:')}
                        />
                    ) : (
                        getInitials(name || 'U')
                    )}
                </div>

                {/* Overlay on hover */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                        'absolute inset-0 rounded-full flex items-center justify-center transition-opacity',
                        'bg-black/40 text-white opacity-0 group-hover:opacity-100',
                        uploading && 'opacity-100 cursor-wait',
                    )}
                >
                    {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <Camera className="h-6 w-6" />
                    )}
                </button>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
                <Upload className="h-3 w-3" />
                {uploading ? 'Uploading…' : 'Change Photo'}
            </button>

            {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                    <X className="h-3 w-3" /> {error}
                </p>
            )}
        </div>
    );
}
