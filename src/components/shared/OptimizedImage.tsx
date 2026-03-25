'use client';

/**
 * OptimizedImage — Drop-in replacement for raw <img> tags.
 *
 * Uses Next.js <Image> component for:
 *   - Automatic WebP/AVIF conversion
 *   - Responsive srcSet generation
 *   - Lazy loading by default
 *   - Blur placeholder while loading
 *   - Proper sizing to prevent CLS (Cumulative Layout Shift)
 *
 * Usage:
 *   <OptimizedImage src={url} alt="Doctor" width={200} height={200} />
 *   <OptimizedImage src={url} alt="Avatar" fill className="object-cover" />
 */

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
    /** Fallback text when image fails to load (e.g. initials) */
    fallbackText?: string;
    /** Fallback background color class */
    fallbackBgClass?: string;
    /** Fallback text color class */
    fallbackTextClass?: string;
}

// Tiny transparent blur placeholder (avoids network request for placeholder)
const BLUR_DATA_URL =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+';

export default function OptimizedImage({
    src,
    alt,
    fallbackText,
    fallbackBgClass = 'bg-gray-100',
    fallbackTextClass = 'text-gray-500',
    className,
    ...props
}: OptimizedImageProps) {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        // Render fallback
        if (fallbackText) {
            return (
                <div
                    className={cn(
                        'flex items-center justify-center font-semibold',
                        fallbackBgClass,
                        fallbackTextClass,
                        className
                    )}
                    style={props.width && props.height ? { width: props.width as number, height: props.height as number } : undefined}
                >
                    {fallbackText}
                </div>
            );
        }
        return (
            <div
                className={cn('bg-gray-100', className)}
                style={props.width && props.height ? { width: props.width as number, height: props.height as number } : undefined}
            />
        );
    }

    // For data: URLs (local previews), skip Next.js optimization
    const isDataUrl = typeof src === 'string' && src.startsWith('data:');

    return (
        <Image
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            unoptimized={isDataUrl}
            onError={() => setHasError(true)}
            {...props}
        />
    );
}
