import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Allowlist: Các routes hợp lệ
  const allowedRoutes = [
    '/',
    '/assets',
    '/orders',
  ];

  // ✅ Prefix match cho dynamic routes
  const allowedPrefixes = [
    '/tradingdashboard/',
  ];

  // Check if route is allowed
  const isAllowed =
    allowedRoutes.includes(pathname.toLowerCase()) ||
    allowedPrefixes.some(prefix => pathname.toLowerCase().startsWith(prefix));

  // ✅ Nếu KHÔNG phải route hợp lệ → redirect về trang chủ /
  if (!isAllowed) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ✅ Onboarding: Bắt buộc xem landing page trước
  // Skip nếu đang ở trang chủ
  if (pathname === '/') {
    // Set cookie khi visit home
    const response = NextResponse.next();
    response.cookies.set('visited_home', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    });
    return response;
  }

  // Check cookie - nếu chưa visit home → redirect về /
  const hasVisitedHome = request.cookies.get('visited_home');
  if (!hasVisitedHome) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// ✅ Matcher: Catch all page routes, exclude API/static/internals
export const config = {
  matcher: [
    /*
     * Match tất cả routes TRỪ:
     * - /api/* (API routes)
     * - /_next/* (Next.js internals)
     * - Static files (có extension: .png, .js, .css, .ico, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};