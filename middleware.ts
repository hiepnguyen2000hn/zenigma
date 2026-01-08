import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Allowlist: Các routes hợp lệ (được phép)
  const allowedRoutes = [
    '/',            // Trang chủ
    '/asset',       // Trang asset
    '/orders',      // Trang orders
  ];

  // ✅ Cho phép các routes bắt đầu bằng (prefix match)
  const allowedPrefixes = [
    '/tradingdashboard/',  // Tất cả trading pairs: /tradingdashboard/btc-usdc, /tradingdashboard/eth-usdc, etc.
    '/api/',               // API routes
    '/_next/',             // Next.js internal
    '/static/',            // Static files
    '/favicon.ico',        // Favicon
  ];

  // Check if route is allowed
  const isAllowed = allowedRoutes.includes(pathname) ||
                    allowedPrefixes.some(prefix => pathname.toLowerCase().startsWith(prefix));

  // ✅ Nếu KHÔNG phải route hợp lệ → redirect về /tradingdashboard/btc-usdc
  if (!isAllowed) {
    return NextResponse.redirect(new URL('/tradingdashboard/btc-usdc', request.url));
  }

  // Cho phép các routes hợp lệ
  return NextResponse.next();
}

// ✅ Matcher: Áp dụng cho tất cả routes trừ static files và API
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static file extensions (.png, .jpg, .svg, .ico, .webp, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)).*)',
  ],
};