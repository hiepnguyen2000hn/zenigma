# Deploy Guide for Vercel

## Những thay đổi đã thực hiện để fix vấn đề chart không load data trên Vercel:

### 1. Cải thiện Chart Component (`components/Chart.tsx`)
- Thêm absolute URL handling cho production environment
- Thêm extensive logging để debug
- Thêm error handling chi tiết hơn
- Thêm `cache: 'no-store'` để tránh caching issues

### 2. Vercel Configuration (`vercel.json`)
- Set maxDuration cho API functions là 30s
- Set region gần Singapore cho low latency
- Configure Next.js framework settings

### 3. Điều chỉnh Next.js Config (`next.config.ts`)
- Đã có image remote patterns cho coinmarketcap và github

## Cách Deploy lên Vercel:

### Option 1: Deploy qua Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option 2: Deploy qua Vercel Dashboard
1. Vào https://vercel.com
2. Import repository từ GitHub
3. Vercel sẽ tự động detect Next.js và build

## Debugging trên Production:

Khi deploy lên Vercel, mở browser console để xem logs:
- 🔄 Fetching chart data from: ...
- 📡 Response status: ...
- ✅ Chart data received: ...
- 💥 Error fetching chart data: ... (nếu có lỗi)

## Potential Issues và Solutions:

### Issue 1: API timeout
**Solution:** Đã set `maxDuration: 30` trong vercel.json

### Issue 2: CORS errors
**Solution:** Next.js API routes tự động handle CORS cho same-origin requests

### Issue 3: Chart không render
**Solution:**
- Kiểm tra browser console logs
- Verify API route hoạt động: `https://your-domain.vercel.app/api/binance/chart/btc-usdt?interval=1h&limit=10`

### Issue 4: WebSocket không connect
**Solution:**
- Binance WebSocket (`wss://stream.binance.com:9443`) should work fine
- Nếu không, có thể cần upgrade Vercel plan cho WebSocket support

## Test Production Build Locally:

```bash
npm run build
npm start
```

Sau đó mở: http://localhost:3000/TradingDashboard/btc-usdt

## Environment Variables (nếu cần):

Hiện tại app không cần environment variables vì đang dùng public Binance API.
Nếu sau này cần API keys, thêm vào Vercel Dashboard:
- Settings → Environment Variables