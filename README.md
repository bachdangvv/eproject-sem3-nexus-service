# Nexus Service Marketing System

Hệ thống quản lý tiếp thị dịch vụ, khảo sát lắp đặt hạ tầng viễn thông và thanh toán cước trực tuyến của **Nexus Communication System** (*eProject Semester 3 — FPT Aptech*), phục vụ 3 nhóm dịch vụ cốt lõi: **Broadband (`B`)**, **Landline / Telephone (`T`)** và **Dial-Up (`D`)**.

---

## 1. Nghiệp vụ & Quy tắc cốt lõi theo đề bài

### Dịch vụ, Tiền đặt cọc & Thuế
- **Tiền đặt cọc hoàn lại (Refundable Security Deposit):**
  - **Broadband (`B`):** `$500.00`
  - **Dial-Up (`D`):** `$325.00`
  - **Landline (`T`):** `$250.00`
- **Thuế dịch vụ theo quy định:** `12.24%` tính trên tổng cước.
- **Chiết khấu đặt cọc theo quy mô đường truyền (Bulk / Corporate Waivers):**
  - `10–14` đường truyền: giảm **25%** đặt cọc
  - `15–24` đường truyền: giảm **50%** đặt cọc
  - `25–50` đường truyền: giảm **75%** đặt cọc
  - `51+` đường truyền: miễn **100%** đặt cọc

### Quy chuẩn mã định danh tự động
| Loại mã | Định dạng | Ví dụ | Thời điểm cấp |
| --- | --- | --- | --- |
| **Customer Code** | `CUS-` + `6 chữ số` | `CUS-000001` | Khi đăng ký hồ sơ khách hàng mới |
| **Order ID** *(11 ký tự)* | `[D\|B\|T]` + `10 chữ số` | `B0000000001` | Khi quầy Retail xác nhận yêu cầu kết nối thành đơn lắp đặt |
| **Account ID** *(16 ký tự)* | `[D\|B\|T]` + `Mã vùng 3 số` + `12 chữ số` | `B101000000000001` | Khi bộ phận Technical kích hoạt kết nối (`Connected`) thành công |

### Luồng vận hành liên phòng ban
1. **Cổng công khai (`/` & `/track`):** Giới thiệu dịch vụ, bảng giá cước tham chiếu và tra cứu trạng thái lắp đặt trực tuyến bằng `Order ID` (11 ký tự) hoặc `Account ID` (16 ký tự) đảm bảo **Zero-PII** (không lộ thông tin cá nhân thuê bao).
2. **Retail Outlet (`/retail/*`):** Tiếp nhận & cập nhật hồ sơ khách hàng, lập phiếu yêu cầu dịch vụ, xác nhận đơn sinh `Order ID` (`Pending`) và ghi nhận phản hồi chất lượng (`Feedback` 1–5 sao) cho đơn đã kích hoạt.
3. **Technical Department (`/technical/*`):** Thẩm định khả thi kỹ thuật (khoảng cách tuyến cáp, dung lượng port server, đường dây Landline đối với gói Dial-Up → `Feasible` hoặc `Not Feasible`) và kích hoạt kết nối (`Connected`) cấp `Account ID` 16 ký tự.
4. **Billing Department (`/billing/*`):** Tra cứu `Account ID`, phát hành bản ghi cước (`NotBilled` → `Unpaid`) và xác nhận thu cước (`Paid` lưu thời điểm thanh toán chuẩn UTC).
5. **Admin Operations (`/admin/*`):** Quản trị danh mục gói cước (`Service Plans`), thiết bị phần cứng (`Products & Equipment`), mã vùng thành phố 3 chữ số (`Territory Cities`), tài khoản nhân sự theo phòng ban (`Employees`) và tra cứu danh bạ khách hàng (`Customers`).

---

## 2. Kiến trúc & Công nghệ

```text
eproject-sem3-nexus-service/
├── backend/
│   ├── Nexus.slnx
│   ├── Nexus.Domain/          # Thực thể nghiệp vụ, quy tắc sinh Order ID / Account ID & vòng đời đơn
│   ├── Nexus.Application/     # Use cases, DTOs, validation & interface truy xuất dữ liệu
│   ├── Nexus.Infrastructure/  # EF Core, migrations (SQLite Demo & SQL Server), password hashing & seed
│   └── Nexus.Api/             # ASP.NET Core (.NET 10) HTTP API, Cookie Auth, CSRF & phân quyền RBAC
├── frontend/
│   ├── src/                   # Ứng dụng React 19 + TypeScript (Public, Login & 4 cổng phòng ban)
│   └── themes/theme-vercel/   # Gói theme tùy biến @nexus/theme-vercel trên nền Astryx Design System
└── docs/
    ├── erd.md                 # Sơ đồ thực thể liên kết (ERD) & quy tắc chuyển trạng thái đơn
    └── api.md                 # Đặc tả HTTP API contract
```

- **Backend:** `.NET 10` ASP.NET Core theo **Clean Architecture** (`Domain` ← `Application` ← `Infrastructure` / `Api`), xác thực phiên bằng `HttpOnly` Cookie kèm bảo vệ CSRF (`X-CSRF-Token`) và giới hạn tần suất đăng nhập (Rate Limiting).
- **Frontend:** `React 19`, `TypeScript`, `Vite 8`, xây dựng hoàn toàn bằng hệ thống thành phần **Astryx Design System** với giao diện sáng tối giản `@nexus/theme-vercel` (`Geist` & `Geist Mono`).

---

## 3. Hướng dẫn khởi chạy cục bộ (Quick Start)

### Yêu cầu môi trường
- **.NET 10 SDK**
- **Node.js `>= 22.13.0`** & **npm**

### Bước 1 — Chạy Backend API (Chế độ Demo SQLite tại `http://127.0.0.1:5168`)
Mở Terminal 1 tại thư mục gốc dự án:

```powershell
dotnet run --project backend/Nexus.Api -- --demo --urls http://127.0.0.1:5168
```

Với cờ `--demo`, hệ thống tự động chạy migration SQLite và khởi tạo dữ liệu mẫu vào `backend/Nexus.Api/demo.db`.
*(Để làm mới lại database demo về trạng thái ban đầu: dừng API rồi chạy `.\backend\scripts\reset-demo.ps1`).*

### Bước 2 — Chạy Frontend Web App (`http://localhost:5173`)
Mở Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Truy cập `http://localhost:5173` trên trình duyệt (Vite tự động proxy `/api` sang `http://127.0.0.1:5168`).

---

## 4. Tài khoản Demo mặc định

Mật khẩu chung cho cả 4 tài khoản nhân viên ở chế độ `--demo`: **`Nexus-Demo-2026!`**

| Tài khoản | Phòng ban (Role) | Đường dẫn mặc định | Chức năng chính |
| --- | --- | --- | --- |
| `admin.demo` | **Admin** | `/admin/plans` | Quản lý gói cước, thiết bị, mã vùng thành phố, nhân viên & danh bạ khách hàng |
| `retail.demo` | **Retail** | `/retail/customers` | Đăng ký khách hàng, tạo yêu cầu dịch vụ, xác nhận sinh `Order ID` & ghi nhận `Feedback` |
| `technical.demo` | **Technical** | `/technical/assessments` | Khảo sát khả thi kỹ thuật (`Feasible` / `Not Feasible`) & kích hoạt kết nối sinh `Account ID` |
| `billing.demo` | **Billing** | `/billing/accounts` | Tra cứu `Account ID`, lập hóa đơn cước & xác nhận thanh toán |

---

## 5. Kiểm tra Build & Triển khai SQL Server

### Kiểm tra Build & Smoke Test
```powershell
# Backend build & smoke test
dotnet build backend/Nexus.slnx
.\backend\scripts\smoke.ps1

# Frontend typecheck, production build & lint
cd frontend
npm run build
npm run lint
```

### Cấu hình SQL Server (Production)
1. Thiết lập biến môi trường `ConnectionStrings__Nexus` trỏ tới SQL Server và khởi chạy API qua HTTPS **không kèm** cờ `--demo`.
2. Khi cơ sở dữ liệu chưa có nhân viên, đặt biến môi trường `NexusBootstrapPassword` (độ dài `12–128` ký tự) trong lần khởi chạy đầu tiên để tạo tài khoản quản trị `admin`, sau đó gỡ biến này khỏi môi trường chạy.
3. Xuất script migration SQL Server dạng idempotent khi cần triển khai thủ công:

```powershell
dotnet tool install dotnet-ef --tool-path .\backend\obj\tools --version 10.0.10
.\backend\obj\tools\dotnet-ef.exe migrations script --idempotent --context SqlServerDb --project backend/Nexus.Infrastructure --startup-project backend/Nexus.Api --output backend/obj/sqlserver-migration.sql
```

### Tài liệu tham khảo nội bộ
- [Sơ đồ ERD và vòng đời đơn hàng](docs/erd.md)
- [Đặc tả API Endpoints](docs/api.md)
