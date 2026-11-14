# API contract Nexus Review 1

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
| `GET /customers?q=...` | Retail | Tối đa 100 khách theo mã, tên hoặc điện thoại. Trả mảng Customer. |
| `POST /customers`, `PUT /customers/{id}` | Retail | `{ name, phone, address, cityCode }` → Customer, 201 hoặc 200 |
| `GET /requests` | Retail | Tối đa 100 Request chờ xác nhận |
| `POST /requests` | Retail | `{ customerId, planId, hasNexusLandline }` → Request, 201. Gói phải đang hoạt động. |
| `POST /requests/{id}/confirm` | Retail | Body trống → Order `Pending`, 201. Lặp lại trả Order hiện có, 200. |
| `GET /orders?code=...&status=...` | Retail, Technical | Tối đa 100 Order. Hai bộ lọc là tùy chọn. |
| `GET /orders/{code}` | Retail, Technical | `{ order, history, feedback }` |
| `POST /orders/{code}/assessment` | Technical | `{ distanceOk, serverAvailable, landlineFeasible, note }` → Order, 200. Hai trường đầu là boolean bắt buộc. Dial-up chưa có đường dây yêu cầu `landlineFeasible`. |
| `POST /orders/{code}/connection` | Technical | Body trống → Order `Connected` với Account ID, 201. Lặp lại trả Connection hiện có, 200. |
| `POST /orders/{code}/feedback` | Retail | `{ rating, comment }` → phản hồi, 201. Rating 1–5 và Order phải ở `Connected`. |

```text
Customer { id, code, name, phone, address, cityCode }
Request  { id, customerId, customerName, planId, planName, type, cityCode,
           address, hasNexusLandline, createdAt }
Order    { code, requestId, status, request, createdAt, accountId, activatedAt }
History  { status, at, actor, note, distanceOk, serverAvailable, landlineFeasible }
Feedback { rating, comment, createdAt }
```

`accountId` và `activatedAt` là `null` cho tới khi cấp kết nối. `status` nhận `Pending`, `Feasible`, `NotFeasible` hoặc `Connected`. Kết quả API dùng `NotFeasible`, còn giao diện hiển thị `Not Feasible`.

Customer có thêm các trường Review 1 tùy chọn: `taxId`, `email`, `contactPerson`, `customerType` và `status`. FE dùng `id` số làm khóa API và `code` dạng `CUS-000001` để hiển thị.

## Public tracking

| Method và đường dẫn | Quyền | Response |
| --- | --- | --- |
| `GET /public/track/order/{code}` | Công khai | Trạng thái order, service type, city và Account ID nếu đã connected |
| `GET /public/track/account/{accountId}` | Công khai | Trạng thái account và order liên kết |

Public tracking chỉ trả dữ liệu nền để FE tự mask customer name và route trước khi hiển thị.

Lỗi 400 cho dữ liệu hoặc token CSRF không hợp lệ, 401 khi phiên hoặc đăng nhập không hợp lệ, 403 khi thiếu quyền, 404 khi không tìm thấy bản ghi, 409 khi sai bước xử lý hoặc trùng dữ liệu và 429 khi vượt giới hạn đăng nhập.
