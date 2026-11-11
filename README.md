# Nexus Service Marketing System

Backend Review 1 xử lý luồng Retail lập đơn và Technical đánh giá khả thi, cấp kết nối, sinh Account ID. Frontend React + Vite do thành viên phụ trách triển khai trong [frontend](frontend/README.md).

## Cấu trúc dự án

```text
backend/
  Nexus.slnx
  Nexus.Domain/          Entity, mã định danh và quy tắc xử lý đơn
  Nexus.Application/     Use case, DTO và interface truy cập dữ liệu
  Nexus.Infrastructure/  EF Core, migration, seed và triển khai các interface
  Nexus.Api/             HTTP endpoint, cookie, CSRF, phân quyền và cấu hình DI
frontend/
  README.md              Hướng dẫn tích hợp React + Vite
```

`Application` phụ thuộc `Domain`. `Infrastructure` triển khai các interface do `Application` định nghĩa. `Api` gọi use case qua `Application` và nối các triển khai `Infrastructure` tại điểm khởi động.

## Chạy backend cục bộ

Cài .NET 10 SDK. Từ thư mục gốc `Nexus`, chạy:

```powershell
dotnet run --project backend/Nexus.Api -- --demo --urls http://127.0.0.1:5168
```

Dùng `GET http://127.0.0.1:5168/api/session` để kiểm tra API. Với cờ `--demo`, API tự áp dụng migration SQLite và seed dữ liệu vào `backend/Nexus.Api/demo.db`. Mật khẩu chung của **tài khoản demo cục bộ** là `Nexus-Demo-2026!`.

| Tài khoản | Vai trò | Mục đích |
| --- | --- | --- |
| `retail.demo` | Retail | Tạo khách hàng và yêu cầu, xác nhận đơn, tra cứu và ghi nhận phản hồi |
| `technical.demo` | Technical | Xử lý hàng chờ, ghi kết quả khả thi và cấp kết nối |
| `admin.demo` | Admin | Quản lý gói dịch vụ, thiết bị, nhân viên và mã thành phố |
| `billing.demo` | Billing | Kiểm tra đăng nhập và phân quyền cho vai trò kế toán |

Tắt máy chủ trước khi chạy `.\backend\scripts\reset-demo.ps1` để xóa database demo mặc định. Khởi động lại để tạo database sạch và sinh mã mẫu từ 1.

## Kiểm tra

Chạy PowerShell 7. Mỗi lượt smoke test dùng một cơ sở dữ liệu SQLite riêng trong `backend/data/`.

```powershell
dotnet build backend/Nexus.slnx
.\backend\scripts\smoke.ps1
```

- [Kịch bản Review 1 và ảnh minh họa từ prototype](docs/review-1.md)
- [ERD và quy tắc vòng đời đơn](docs/erd.md)
- [API contract](docs/api.md)

## Cấu hình SQL Server

Đặt `ConnectionStrings__Nexus` trỏ tới SQL Server của dự án. Khởi động qua HTTPS và bỏ cờ `--demo`. API áp dụng migration SQL Server lúc khởi động. Tài khoản SQL cần quyền áp dụng migration trong giai đoạn khởi tạo. Khi database chưa có nhân viên, dùng biến môi trường `NexusBootstrapPassword` dài 12–128 ký tự để tạo tài khoản `admin` một lần, rồi bỏ biến khỏi môi trường chạy. Admin có thể thêm thành phố, gói và tài khoản nhân viên qua API. Nếu truy cập bằng tên máy chủ khác, cấu hình `AllowedHosts` tương ứng.

```powershell
dotnet tool install dotnet-ef --tool-path .\backend\obj\tools --version 10.0.10
.\backend\obj\tools\dotnet-ef.exe migrations script --idempotent --context SqlServerDb --project backend/Nexus.Infrastructure --startup-project backend/Nexus.Api --output backend/obj/sqlserver-migration.sql
```

Migration nằm trong `backend/Nexus.Infrastructure/Persistence/Migrations`. Khi đổi schema, tạo migration cho cả `DemoDb` và `SqlServerDb`.
