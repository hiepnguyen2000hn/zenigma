import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Allowlist: Các routes hợp lệ (được phép)
  const allowedRoutes = [
    '/',            // Trang chủ
    '/assets',      // Trang assets
    '/orders',      // Trang orders
  ];

  // ✅ Cho phép các routes bắt đầu bằng (prefix match)
  const allowedPrefixes = [
    '/tradingdashboard/',  // Tất cả trading pairs
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

// ✅ Matcher: CHỈ áp dụng cho PAGE ROUTES, KHÔNG cho API/static/external
export const config = {
  matcher: [
    /*
     * ✅ CHỈ match page routes cụ thể:
     * - / (home)
     * - /assets
     * - /orders
     * - /tradingdashboard/:path*
     *
     * ❌ KHÔNG match:
     * - /api/* (API routes)
     * - /_next/* (Next.js internals)
     * - Static files (.png, .js, .css, etc.)
     * - External requests
     */
    '/',
    '/assets',
    '/orders',
    '/tradingdashboard/:path*',
  ],
};