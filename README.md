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

- **Danh mục gói cước chuẩn (18 gói khởi tạo mẫu):** Bao gồm đầy đủ các gói **Dial-Up (`D`)**, **Broadband (`B`)** và **Landline (`T`)** với thời hạn hiệu lực `ValidityMonths` (`1`, `3`, `6` hoặc `12` tháng), giới hạn giờ (`HoursAllowance`) hoặc băng thông (`SpeedKbps`) và đơn giá gọi Local/STD/Mobile.
  - *Lưu ý về gói `Landline STD Yearly`:* Tài liệu đặc tả gốc (`Doc 1 §Financial, p.6`) bỏ trống con số giá cước (`Yearly - $`), nên hệ thống sử dụng **`$780`** làm giá khởi tạo mặc định giả định (Admin có thể chỉnh sửa trực tiếp qua giao diện quản trị).

### Quy chuẩn mã định danh tự động
| Loại mã | Định dạng | Ví dụ | Thời điểm cấp |
| --- | --- | --- | --- |
| **Customer Code** | `CUS-` + `6 chữ số` | `CUS-000001` | Khi nhân viên Retail tạo hồ sơ hoặc khách hàng tự đăng ký (`/register`) |
| **Order ID** *(11 ký tự)* | `[D\|B\|T]` + `10 chữ số` | `B0000000001` | Khi quầy Retail xác nhận yêu cầu kết nối thành đơn lắp đặt |
| **Account ID** *(16 ký tự)* | `[D\|B\|T]` + `Mã vùng 3 số` + `12 chữ số` | `B101000000000001` | Khi bộ phận Technical kích hoạt kết nối (`Connected`) thành công |

### Luồng vận hành liên phòng ban
1. **Cổng công khai (`/`, `/track`, `/login` & `/register`):** Giới thiệu dịch vụ, nạp bảng giá gói cước đang hoạt động từ `/api/public/plans`, danh mục thành phố (`/api/public/cities`), tra cứu FAQ động ngay trên trang chủ (`/api/faq`), tra cứu trạng thái đơn hàng hoặc kết nối thực tế (`Active` / `TemporarilyInactive` / `PermanentlyInactive`) kèm dư nợ (`dueAmount`) bằng `Order ID` (11 ký tự) hoặc `Account ID` (16 ký tự) đảm bảo **Zero-PII** (không lộ tên/địa chỉ thuê bao), đăng nhập chung (`/login`) và **tự đăng ký tài khoản khách hàng (`/register` → `POST /api/register`)** kích hoạt ngay (`ACTIVE`) kèm phiên đăng nhập tức thì.
2. **Retail Outlet (`/retail/*`):** Tiếp nhận & cập nhật hồ sơ khách hàng, lập phiếu yêu cầu dịch vụ, xác nhận đơn sinh `Order ID` (`Pending`), ghi nhận phản hồi (`Feedback` 1–5 sao), thu cước trực tiếp tại quầy (`RetailOutlet`, hỗ trợ thanh toán từng phần `PartiallyPaid`), lưu trữ/tải lên hồ sơ chứng từ khách hàng theo năm & mã vùng, gửi yêu cầu đổi gói cước cùng loại dịch vụ và tiếp nhận/đóng câu hỏi hỗ trợ khách hàng.
3. **Technical Department (`/technical/*`):** Thẩm định khả thi kỹ thuật (khoảng cách tuyến cáp, dung lượng port server, đường dây Landline đối với gói Dial-Up → `Feasible` hoặc `Not Feasible`), kích hoạt kết nối (`Connected`) cấp `Account ID` 16 ký tự kèm trừ tồn kho thiết bị theo `ConnectionCount`, quản lý tồn kho/sự cố hỏng hóc thiết bị, vận hành vòng đời kết nối (`Suspend`, `Reactivate`, `Terminate` tính hoàn cọc tự động) và phê duyệt/từ chối yêu cầu đổi gói cước.
4. **Billing Department (`/billing/*`):** Tra cứu `Account ID` (kèm tìm kiếm `?q=`), phát hành hóa đơn chu kỳ mới (tự động cộng phí sự cố thiết bị chưa thanh toán, kết chuyển hóa đơn cũ sang `RolledOver`, áp dụng chiết khấu bulk & thuế 12.24%), ghi nhận thanh toán `CityOffice` (`PartiallyPaid`/`Paid`) và giải ngân hoàn trả tiền đặt cọc (`POST /api/billing/accounts/{accountId}/refund`) cho thuê bao đã chấm dứt.
5. **Admin Operations (`/admin/*`):** Quản trị danh mục gói cước (`Service Plans`), thiết bị phần cứng (`Products & Equipment` — chia sẻ quyền đọc/thêm/sửa với `Technical`, giữ quyền lưu trữ `DELETE` cho `Admin`), mã vùng thành phố 3 chữ số (`Territory Cities`), quầy bán lẻ (`Retail Shops`), nhà cung cấp (`Vendors`), đơn mua sắm & thanh toán nhà cung cấp (`Purchase Orders` / `Vendor Payments`), nhân sự và tài khoản đăng nhập (`Employees` — hỗ trợ vô hiệu hóa/kích hoạt lại tài khoản `Active = true/false`, giữ bất biến vai trò `Customer` và không gán `retailShopId`), **tạm ngưng/kích hoạt lại hồ sơ khách hàng (`SUSPENDED` / `ACTIVE`)** và tra cứu khách hàng/chứng từ/hỏi đáp.
6. **Customer Portal (`/customer` & `/customer/*`):** Cổng tự phục vụ dành riêng cho vai trò `Customer` (`/api/customer/*`): xem/cập nhật hồ sơ cá nhân (`CUS-xxxxxx`, trạng thái `ACTIVE`/`SUSPENDED`), xem gói cước và gửi yêu cầu lắp đặt mới (hỗ trợ đa đường truyền `ConnectionCount` & chiết khấu đặt cọc), theo dõi tiến độ đơn hàng & gửi đánh giá dịch vụ (1–5 sao khi đơn `Connected`), quản lý kết nối/hóa đơn và **thanh toán cước trực tuyến** toàn bộ hoặc từng phần (kênh `CustomerPortal`), gửi yêu cầu đổi gói cước cùng loại dịch vụ, gửi câu hỏi hỗ trợ và tra cứu FAQ. Dữ liệu được cô lập chặt chẽ theo chủ sở hữu (truy cập chéo trả `404`) và chặn truy cập mọi route nhân viên (`403`, bao gồm `/api/retail-shops`).

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
│   ├── src/                   # Ứng dụng React 19 + TypeScript (Public, Login/Register, 4 cổng phòng ban & Customer Portal)
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
*(Để làm mới lại database demo về trạng thái ban đầu: dừng API rồi chạy `.\backend\scripts\reset-demo.ps1` — script sẽ xóa `demo.db*`, dọn dẹp tệp chứng từ tại `backend/Nexus.Api/data/documents/*` và thư mục `backend/data/smoke-*` trong khi vẫn giữ nguyên khóa phiên `backend/Nexus.Api/data/demo-keys`).*

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

Mật khẩu chung cho cả 5 tài khoản mẫu (4 nhân viên phòng ban & 1 khách hàng) ở chế độ `--demo`: **`Nexus-Demo-2026!`**

| Tài khoản | Phòng ban / Vai trò (Role) | Đường dẫn mặc định | Chức năng chính |
| --- | --- | --- | --- |
| `admin.demo` | **Admin** | `/admin/plans` | Quản lý gói cước, thiết bị, mã vùng thành phố, nhân viên & danh bạ khách hàng |
| `retail.demo` | **Retail** | `/retail/customers` | Đăng ký khách hàng, tạo yêu cầu dịch vụ, xác nhận sinh `Order ID` & ghi nhận `Feedback` |
| `technical.demo` | **Technical** | `/technical/assessments` | Khảo sát khả thi kỹ thuật (`Feasible` / `Not Feasible`) & kích hoạt kết nối sinh `Account ID` |
| `billing.demo` | **Billing** | `/billing/accounts` | Tra cứu `Account ID`, lập hóa đơn cước & xác nhận thanh toán |
| `customer.demo` | **Customer** | `/customer` | Liên kết khách hàng mẫu **Trần Minh B** (`CUS-000001`): quản lý hồ sơ, gửi yêu cầu lắp đặt, theo dõi đơn/kết nối, thanh toán trực tuyến (`CustomerPortal`), đổi gói & hỏi đáp |

> **Lưu ý tự đăng ký & khóa tài khoản khách hàng:** Khách hàng tự đăng ký tại `/register` (`POST /api/register`) được kích hoạt ngay ở trạng thái `ACTIVE` và đăng nhập tức thì vào `/customer`. Khi Admin tạm ngưng hồ sơ khách hàng (`Customer.Status = "SUSPENDED"`) hoặc vô hiệu hóa tài khoản đăng nhập (`Employee.Active = false`), hệ thống từ chối đăng nhập (`403 Forbidden`) và chặn mọi thao tác ghi tự phục vụ trên `/api/customer/*` (`403 Forbidden`; riêng `Employee.Active = false` chặn cả thao tác đọc).

---

## 5. Kiểm tra Build & Triển khai SQL Server

### Kiểm tra Build & Smoke Test
```powershell
# Backend build, EF Core model check, reset demo & smoke test
dotnet build backend/Nexus.slnx
.\backend\obj\tools\dotnet-ef.exe migrations has-pending-model-changes --project backend/Nexus.Infrastructure --startup-project backend/Nexus.Api --context DemoDb
.\backend\obj\tools\dotnet-ef.exe migrations has-pending-model-changes --project backend/Nexus.Infrastructure --startup-project backend/Nexus.Api --context SqlServerDb
.\backend\scripts\reset-demo.ps1
.\backend\scripts\smoke.ps1

# Frontend typecheck, production build, lint & Astryx design doctor
cd frontend
npx tsc -b --force
npm run build
npm run lint
npx @astryxdesign/cli doctor --built src --json
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
