# API contract Nexus Review 1 & Financial Billing Engine

Các route dùng tiền tố `/api`, JSON camelCase và xác thực bằng cookie phiên. Lấy `csrfToken` từ `GET /session`, gửi trong header `X-CSRF-Token` khi gọi POST, PUT hoặc DELETE. Đọc lại session sau đăng nhập hoặc đăng xuất để dùng token của phiên hiện tại. Thời gian trong API trả về theo UTC.

## Phiên và danh mục

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /session` | Công khai | `{ csrfToken, username, displayName, role }`. Ba trường cuối là `null` trước khi đăng nhập. |
| `POST /login` | Công khai | `{ username, password }` → 204 và cookie phiên |
| `POST /logout` | Đã đăng nhập | 204 |
| `GET /cities` | Đã đăng nhập | Danh sách `{ code, name }` |
| `POST /cities` | Admin | `{ code, name }` → 201. Mã thành phố có ba chữ số. |
| `GET /plans` | Đã đăng nhập | Danh sách `{ id, name, type, description, price, active }`. Admin thấy cả gói ngừng dùng. |
| `POST /plans`, `PUT /plans/{id}` | Admin | `{ name, type, description, price, active }` → bản ghi 201 hoặc 200. `type` thuộc D/B/T. Giá USD với tối đa hai chữ số thập phân. |
| `DELETE /plans/{id}` | Admin | 204, chuyển sang ngừng dùng |
| `GET /products` | Admin | Danh sách `{ id, name, description, active }` |
| `POST /products`, `PUT /products/{id}` | Admin | `{ name, description, active }` → bản ghi 201 hoặc 200 |
| `DELETE /products/{id}` | Admin | 204, chuyển sang ngừng dùng |
| `GET /employees` | Admin | Danh sách `{ id, username, displayName, role }` |
| `POST /employees` | Admin | `{ username, displayName, role, password }` → 201 và thông tin nhân viên |

## Khách hàng và xử lý đơn

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /customers?q=...` | Retail, Admin | Tối đa 100 khách theo mã, tên hoặc điện thoại. Trả mảng Customer. |
| `POST /customers`, `PUT /customers/{id}` | Retail, Admin | `{ name, phone, address, cityCode }` và các trường tùy chọn → Customer, 201 hoặc 200 |
| `GET /requests` | Retail | Tối đa 100 Request chờ xác nhận |
| `POST /requests` | Retail | `{ customerId, planId, hasNexusLandline, connectionCount }` → Request, 201. Gói phải đang hoạt động. `connectionCount` mặc định 1. |
| `POST /requests/{id}/confirm` | Retail | Body trống → Order `Pending`, 201. Lặp lại trả Order hiện có, 200. |
| `GET /orders?code=...&status=...` | Retail, Technical | Tối đa 100 Order. Hai bộ lọc là tùy chọn. |
| `GET /orders/{code}` | Retail, Technical | `{ order, history, feedback }` |
| `POST /orders/{code}/assessment` | Technical | `{ distanceOk, serverAvailable, landlineFeasible, note }` → Order, 200. Hai trường đầu là boolean bắt buộc. Dial-up chưa có đường dây yêu cầu `landlineFeasible`. |
| `POST /orders/{code}/connection` | Technical | Body trống → Order `Connected` với Account ID, 201. Lặp lại trả Connection hiện có, 200. |
| `POST /orders/{code}/feedback` | Retail | `{ rating, comment }` → phản hồi, 201. Rating 1–5 và Order phải ở `Connected`. |

```text
Customer { id, code, name, phone, address, cityCode }
Request  { id, customerId, customerName, planId, planName, type, cityCode,
           address, hasNexusLandline, price, connectionCount, createdAt }
Order    { code, requestId, status, request, createdAt, accountId, activatedAt }
History  { status, at, actor, note, distanceOk, serverAvailable, landlineFeasible }
Feedback { rating, comment, createdAt }
```

`accountId` và `activatedAt` là `null` cho tới khi cấp kết nối. `status` nhận `Pending`, `Feasible`, `NotFeasible` hoặc `Connected`. Kết quả API dùng `NotFeasible`, còn giao diện hiển thị `Not Feasible`.

Customer có thêm các trường Review 1 tùy chọn: `taxId`, `email`, `contactPerson`, `customerType` và `status`. FE dùng `id` số làm khóa API và `code` dạng `CUS-000001` để hiển thị.

## Billing và Payment (Phòng Cước & Quầy Bán Lẻ)

### Billing Department (Role = Billing)

| Method và đường dẫn | Quyền | Kết quả |
| --- | --- | --- |
| `GET /billing/accounts?q=...&status=...&cityCode=...` | Billing | Danh sách tất cả tài khoản kết nối đang hoạt động kèm chi tiết hóa đơn mới nhất và các thanh toán. Hỗ trợ lọc theo từ khóa, trạng thái hóa đơn (`NotBilled`, `Unpaid`, `PartiallyPaid`, `Paid`) và thành phố. |
| `GET /billing/accounts/{accountId}` | Billing | Tra cứu chi tiết tài khoản theo 16 ký tự Account ID, trả về đầy đủ các mục chi phí (tiền cước gói, cước gọi Local/STD/Mobile, phí thiết bị hỏng, chiết khấu bulk, thuế dịch vụ 12.24%, tiền cọc hoàn lại, dư nợ cũ, tổng nợ, đã trả, còn nợ) và lịch sử giao dịch. |
| `POST /billing/accounts/{accountId}` | Billing | Tạo hóa đơn chu kỳ mới hoặc lập hóa đơn ban đầu. Body tùy chọn: `{ billingPeriodStart, billingPeriodEnd, localMinutes, stdMinutes, mobileMinutes, equipmentFee, depositAmount }`. Tự động áp dụng chiết khấu số lượng (25%–100%) và thuế dịch vụ 12.24% trên cước chịu thuế. |
| `POST /billing/accounts/{accountId}/payment` | Billing | Ghi nhận thanh toán tại City Office (toàn bộ hoặc từng phần). Body tùy chọn: `{ amount, note }`. Ghi nhận người thu và kênh thanh toán `"CityOffice"`. |

### Retail Outlet In-Store Billing & Payments (Role = Retail)

| Method và đường dẫn | Quyền | Kết quả |
| --- | --- | --- |
| `GET /retail/billing/accounts?q=...&status=...&cityCode=...` | Retail | Tra cứu danh sách tài khoản đã kết nối để phục vụ khách hàng thanh toán tại quầy bán lẻ. |
| `GET /retail/billing/accounts/{accountId}` | Retail | Xem chi tiết cước tính đến thời điểm hiện tại của thuê bao (till-date billing breakdown). |
| `POST /retail/billing/accounts/{accountId}/payment` | Retail | Thu tiền cước trực tiếp tại quầy bán lẻ (in-store retail counter). Body tùy chọn: `{ amount, note }`. Ghi nhận người thu và kênh thanh toán `"RetailOutlet"`. |

Các POST hỗ trợ gửi kèm body JSON hoặc body trống (mặc định lấy toàn bộ số dư còn nợ). Trạng thái tài khoản chuyển từ `NotBilled → Unpaid / PartiallyPaid → Paid`.

## Public tracking

| Method và đường dẫn | Quyền | Response |
| --- | --- | --- |
| `GET /public/track/order/{code}` | Công khai | Trạng thái order, service type, city và Account ID nếu đã connected |
| `GET /public/track/account/{accountId}` | Công khai | Trạng thái account và order liên kết |

Public tracking chỉ trả trạng thái, loại dịch vụ, mã thành phố và mã tham chiếu. Tên và địa chỉ khách hàng chỉ xuất hiện trong các API nội bộ có phân quyền.

Lỗi 400 cho dữ liệu hoặc token CSRF không hợp lệ, 401 khi phiên hoặc đăng nhập không hợp lệ, 403 khi thiếu quyền, 404 khi không tìm thấy bản ghi, 409 khi sai bước xử lý hoặc trùng dữ liệu và 429 khi vượt giới hạn đăng nhập.
