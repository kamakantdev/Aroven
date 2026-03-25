import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || ''
);

async function verifyJwt(token: string): Promise<{ valid: boolean; role?: string; expired?: boolean }> {
    try {
        if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
            const parts = token.split('.');
            if (parts.length !== 3) return { valid: false };
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                return { valid: false, expired: true };
            }
            return { valid: true, role: payload.role };
        }

        const { payload } = await jwtVerify(token, JWT_SECRET);
        return { valid: true, role: payload.role as string };
    } catch (error: unknown) {
        const isExpired = error instanceof Error && error.message.includes('expired');
        return { valid: false, expired: isExpired };
    }
}

const ROUTE_ROLES: Record<string, string[]> = {
    '/admin': ['admin', 'super_admin'],
    '/doctor': ['doctor'],
    '/hospital': ['hospital_owner'],
    '/clinic': ['clinic_owner'],
    '/diagnostic-center': ['diagnostic_center_owner'],
    '/pharmacy': ['pharmacy_owner'],
    '/consultation': ['doctor'],
};

const ROUTE_TO_LOGIN_SLUG: Record<string, string> = {
    '/admin': 'admin',
    '/doctor': 'doctor',
    '/hospital': 'hospital',
    '/clinic': 'clinic',
    '/diagnostic-center': 'diagnostic-center',
    '/pharmacy': 'pharmacy',
    '/consultation': 'doctor',
};

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const matchedPrefix = Object.keys(ROUTE_ROLES).find((prefix) =>
        pathname.startsWith(prefix)
    );

    if (!matchedPrefix) {
        return NextResponse.next();
    }

    const token = request.cookies.get('swastik-token')?.value;
    const cookieRole = request.cookies.get('swastik-role')?.value;

    const redirectToLogin = (expired = false) => {
        const loginSlug = ROUTE_TO_LOGIN_SLUG[matchedPrefix] || matchedPrefix.replace('/', '');

        const loginUrl = new URL(`/login/${loginSlug}`, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        if (expired) loginUrl.searchParams.set('expired', '1');
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set('swastik-role', '', { maxAge: 0, path: '/' });
        response.cookies.set('swastik-token', '', { maxAge: 0, path: '/' });
        return response;
    };

    if (!token) {
        return redirectToLogin();
    }

    const verification = await verifyJwt(token);

    if (!verification.valid) {
        return redirectToLogin(verification.expired);
    }

    const role = verification.role || cookieRole;

    if (!role) {
        return redirectToLogin();
    }

    const allowedRoles = ROUTE_ROLES[matchedPrefix];
    if (!allowedRoles.includes(role)) {
        const homeRoute = Object.entries(ROUTE_ROLES).find(([, roles]) =>
            roles.includes(role)
        );
        if (homeRoute) {
            return NextResponse.redirect(new URL(homeRoute[0], request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/doctor/:path*',
        '/hospital/:path*',
        '/clinic/:path*',
        '/diagnostic-center/:path*',
        '/pharmacy/:path*',
        '/consultation/:path*',
    ],
};