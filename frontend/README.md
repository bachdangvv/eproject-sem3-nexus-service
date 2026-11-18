# Nexus Service Marketing System — Frontend

Giao diện người dùng của **Nexus Service Marketing System**, xây dựng bằng **React 19**, **TypeScript**, **Vite 8** và **Astryx Design System** cùng gói theme tùy biến `@nexus/theme-vercel` (`Geist` & `Geist Mono`).

## Cấu trúc thư mục

- `src/pages/HomePage.tsx` & `src/components/landing/LandingTrackPage.tsx` — Trang chủ giới thiệu dịch vụ, bảng cước tham chiếu và cổng tra cứu `Order ID` / `Account ID` công khai (`/` và `/track`).
- `src/App.tsx` — Điều hướng chính, màn hình đăng nhập nhân viên (`/login`) và bố cục `AppShell` + `SideNav` cho 4 phòng ban.
- `src/pages/admin/` — Cổng quản trị danh mục gói cước, thiết bị, thành phố, nhân sự và khách hàng (`/admin/*`).
- `src/pages/retail/` — Cổng quầy giao dịch Retail (`/retail/*`).
- `src/pages/technical/` — Cổng thẩm định khả thi và kích hoạt kết nối Technical (`/technical/*`).
- `src/pages/billing/` — Cổng lập hóa đơn và ghi nhận thanh toán Billing (`/billing/*`).
- `src/services/` — Lớp gọi REST API kết nối trực tiếp tới Backend `.NET 10` kèm tự động đồng bộ Cookie Session & `X-CSRF-Token`.
- `themes/theme-vercel/` — Gói theme nội bộ `@nexus/theme-vercel`.

## Lệnh phát triển

```powershell
# Cài đặt dependencies
npm install

# Chạy dev server tại http://localhost:5173 (proxy /api -> http://127.0.0.1:5168)
npm run dev

# Kiểm tra kiểu TypeScript & đóng gói bản production
npm run build

# Kiểm tra quy tắc mã nguồn với Oxlint
npm run lint
```
