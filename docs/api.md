# API contract Nexus Review 1, Financial Billing Engine, Inventory Management & Customer Portal

Các route dùng tiền tố `/api`, JSON camelCase và xác thực bằng cookie phiên (`Nexus.Session`). Lấy `csrfToken` từ `GET /session`, gửi trong header `X-CSRF-Token` khi gọi POST, PUT hoặc DELETE. Đọc lại `GET /session` sau `POST /login`, `POST /register` hoặc `POST /logout` để dùng token của phiên hiện tại. Thời gian trong API trả về theo UTC.

## Phiên và danh mục

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /session` | Công khai | `{ csrfToken, username, displayName, role, customerId, customerCode }`. Năm trường sau `csrfToken` là `null` trước khi đăng nhập; `customerId` (`int?`) và `customerCode` (`CUS-000001` hoặc `null`) là `null` với nhân viên (`Roles.Staff`) và có giá trị với tài khoản `Customer`. |
| `POST /login` | Công khai | `{ username, password }` → `204` và cookie phiên `Nexus.Session`. Áp dụng giới hạn tần suất `"login"` (`12` req/phút/IP → `429`) và kiểm tra CSRF (`400`). Sai thông tin đăng nhập hoặc nhân viên bị vô hiệu hóa (`active = false`) trả `401` ProblemDetails (`"Invalid username or password."`). Tài khoản `Customer` bị vô hiệu hóa trả `403` ProblemDetails (`"Customer login is deactivated."`), hoặc hồ sơ `Customer` liên kết ở trạng thái `SUSPENDED`/thiếu trả `403` ProblemDetails (`"Customer account is suspended."`). |
| `POST /logout` | Đã đăng nhập (bao gồm `Customer`) | `204` |
| `GET /cities` | Đã đăng nhập (bao gồm `Customer`) | Danh sách `{ code, name }` |
| `POST /cities` | Admin | `{ code, name }` → 201. Mã thành phố có ba chữ số. |
| `PUT /cities/{code}` | Admin | `{ name }` → 200. Cập nhật tên hiển thị thành phố theo mã 3 chữ số. |
| `GET /plans` | Đã đăng nhập (bao gồm `Customer`) | Danh sách `{ id, name, type, description, price, active, localCallRate, stdCallRate, mobileMsgRate, validityMonths, hoursAllowance, speedKbps }`. Chỉ Admin thấy cả gói ngừng dùng (`active = false`). |
| `POST /plans`, `PUT /plans/{id}` | Admin | `{ name, type, description, price, active, localCallRate, stdCallRate, mobileMsgRate, validityMonths, hoursAllowance?, speedKbps? }` → bản ghi 201 hoặc 200. `type` thuộc `D/B/T`, `validityMonths` thuộc `{1, 3, 6, 12}`. Giá USD với tối đa hai chữ số thập phân. |
| `DELETE /plans/{id}` | Admin | 204, chuyển sang ngừng dùng |
| `GET /products` | Technical, Admin | Danh sách `{ id, name, description, active, quantityInStock, replacementPrice }` |
| `POST /products`, `PUT /products/{id}` | Technical, Admin | `{ name, description, active, quantityInStock, replacementPrice }` (`quantityInStock >= 0`) → bản ghi 201 hoặc 200 |
| `DELETE /products/{id}` | Admin | 204, chuyển sang ngừng dùng |
| `GET /employees` | Admin | Danh sách `{ id, username, displayName, role, active, retailShopId, customerId }` (bao gồm cả tài khoản `Customer` như `customer.demo`). |
| `POST /employees` | Admin | `{ username, displayName, role, password, retailShopId? }` → `201` `EmployeeView`. Chỉ chấp nhận `role` thuộc `Roles.Staff` (`Admin`, `Retail`, `Technical`, `Billing`; từ chối `Customer` với `400`). Mật khẩu tối thiểu `12` ký tự (`12..128`), `username` (`^[a-zA-Z0-9._-]{3,40}$`) từ chối mẫu `^cus-[0-9]+$` (`400`), trùng username trả `409`. Tài khoản nhân viên `active = false` bị từ chối đăng nhập (`401`), còn tài khoản `Customer` bị vô hiệu hóa trả `403`. |
| `PUT /employees/{id}` | Admin | `{ displayName, role, password?, retailShopId?, active? }` → `200` `EmployeeView`. Hỗ trợ cập nhật `active` (`bool?`) để vô hiệu hóa/kích hoạt lại; chặn tự vô hiệu hóa chính mình (`409`) và chặn vô hiệu hóa hoặc hạ quyền `Admin` hoạt động cuối cùng (`409`). Với tài khoản `Customer`: bắt buộc giữ nguyên `role = "Customer"` (`400`) và `retailShopId = null` (`400`), đồng thời không cho đổi tài khoản nhân viên sang `Customer` (`400`). |
| `DELETE /employees/{id}` | Admin | `200` `EmployeeView` (`active = false`). Vô hiệu hóa mềm tài khoản (áp dụng cho cả nhân viên và `Customer`); trả `409` nếu tự vô hiệu hóa chính mình hoặc vô hiệu hóa `Admin` hoạt động cuối cùng. Với tài khoản `Customer`, mọi lần `/login` và đọc/ghi `/customer/*` sau đó đều bị chặn (`403`). |

## Khách hàng và xử lý đơn

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /customers?q=...` | Retail, Admin | Tối đa 100 khách theo mã, tên hoặc điện thoại. Trả mảng Customer. |
| `POST /customers`, `PUT /customers/{id}` | Retail, Admin | `{ name, phone, address, cityCode }` và các trường tùy chọn (`taxId`, `email`, `contactPerson`, `customerType`, `status`: `"ACTIVE"` \| `"SUSPENDED"`) → Customer, `201` hoặc `200`. Khi đặt `status: "SUSPENDED"`, tài khoản `Customer` liên kết bị chặn đăng nhập (`403`) và bị chặn mọi thao tác ghi trên `/customer/*` (`403`). |
| `GET /requests` | Retail | Tối đa 100 Request chờ xác nhận |
| `POST /requests` | Retail | `{ customerId, planId, hasNexusLandline, connectionCount }` → Request, 201. Gói phải đang hoạt động. `connectionCount` mặc định 1. |
| `POST /requests/{id}/confirm` | Retail | Body trống → Order `Pending`, 201. Lặp lại trả Order hiện có, 200. |
| `GET /orders?code=...&status=...` | Retail, Technical | Tối đa 100 Order. Hai bộ lọc là tùy chọn. |
| `GET /orders/{code}` | Retail, Technical | `{ order, history, feedback }` |
| `POST /orders/{code}/assessment` | Technical | `{ distanceOk, serverAvailable, landlineFeasible, note }` → Order, 200. Hai trường đầu là boolean bắt buộc. Dial-up chưa có đường dây yêu cầu `landlineFeasible`. |
| `POST /orders/{code}/connection` | Technical | Body tùy chọn `{ productId }` → Order `Connected` với Account ID, 201 (nếu có `productId` thì kiểm tra tồn kho >= `connectionCount`, cấp thiết bị và giảm `QuantityInStock` theo `connectionCount`; 400 nếu thiếu kho, 409 nếu xung đột đồng thời). Lặp lại trả Connection hiện có, 200. |
| `POST /orders/{code}/feedback` | Retail | `{ rating, comment }` → phản hồi, 201. Rating 1–5 và Order phải ở `Connected`. |

```text
Customer { id, code, name, phone, address, cityCode }
Request  { id, customerId, customerName, planId, planName, type, cityCode,
           address, hasNexusLandline, price, createdAt, connectionCount, customerPhone }
Order    { code, requestId, status, request, createdAt, accountId, activatedAt,
           assignedProductId, customerName, type, serviceType, customerPhone }
History  { status, at, actor, note, distanceOk, serverAvailable, landlineFeasible }
Feedback { rating, comment, createdAt }
```

`accountId` và `activatedAt` là `null` cho tới khi cấp kết nối. `status` nhận `Pending`, `Feasible`, `NotFeasible` hoặc `Connected`. Kết quả API dùng `NotFeasible`, còn giao diện hiển thị `Not Feasible`.

Customer có thêm các trường Review 1 tùy chọn: `taxId`, `email`, `contactPerson`, `customerType` và `status`. FE dùng `id` số làm khóa API và `code` dạng `CUS-000001` để hiển thị.

## Quản lý Quầy Bán Lẻ (Retail Shops) & Nhà Cung Cấp (Vendors)

### Retail Shops

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /retail-shops?cityCode=...` | Staff (`Admin`, `Retail`, `Technical`, `Billing`) | Danh sách `{ id, code, name, cityCode, cityName, address, phone, active }` (chỉ lấy điểm đang hoạt động). Vai trò `Customer` bị từ chối với `403 Forbidden`. |
| `GET /admin/retail-shops?cityCode=...` | Admin | Danh sách đầy đủ quầy giao dịch (kể cả inactive). Hỗ trợ lọc theo `cityCode`. |
| `POST /admin/retail-shops` | Admin | `{ code, name, cityCode, address, phone, active }` → 201 RetailShop. |
| `PUT /admin/retail-shops/{id}` | Admin | `{ code, name, cityCode, address, phone, active }` → 200 RetailShop. |
| `DELETE /admin/retail-shops/{id}` | Admin | 204 NoContent (chuyển sang không hoạt động). |

### Vendors (Nhà Cung Cấp Thiết Bị)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /admin/vendors` | Admin | Danh sách vendors `{ id, code, name, contactPerson, phone, email, address, active }`. |
| `POST /admin/vendors` | Admin | `{ code, name, contactPerson, phone, email, address, active }` → 201 Vendor. |
| `PUT /admin/vendors/{id}` | Admin | `{ code, name, contactPerson, phone, email, address, active }` → 200 Vendor. |
| `DELETE /admin/vendors/{id}` | Admin | 204 NoContent (chuyển sang không hoạt động). |

## Đơn Hàng Mua Sắm (Purchase Orders) & Thanh Toán Vendor (Vendor Payments)

### Purchase Orders

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /admin/purchases?status=...` | Admin | Danh sách đơn mua sắm thiết bị. Lọc theo trạng thái `Ordered`, `Received`, `Cancelled`. |
| `POST /admin/purchases` | Admin | `{ vendorId, productId, quantity, unitPrice, note }` → 201 PurchaseOrder. Tự động tính `totalAmount = quantity * unitPrice`. |
| `POST /admin/purchases/{id}/receive` | Admin | 200 PurchaseOrder. Đánh dấu `Received`, ghi nhận `receivedAt`, tự động cộng dồn `quantity` vào `Product.QuantityInStock`. |
| `POST /admin/purchases/{id}/cancel` | Admin | 200 PurchaseOrder. Hủy đơn mua sắm chưa nhận hàng. |

### Vendor Payments

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /admin/vendor-payments?purchaseOrderId=...` | Admin | Danh sách các khoản thanh toán cho nhà cung cấp, hỗ trợ lọc theo đơn mua hàng. |
| `POST /admin/vendor-payments` | Admin | `{ purchaseOrderId, amount, method, reference, note }` → 201 VendorPayment (`method`: `BankTransfer`, `Cheque`, `Cash`). Trả 409 Conflict nếu đơn mua sắm đã ở trạng thái `Cancelled`. |

## Kỹ Thuật: Quản Lý Thiết Bị & Sự Cố Thiết Bị Hỏng (Technical Equipment & Incidents)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /technical/equipment` | Technical, Admin | Danh sách thiết bị và tồn kho `{ id, name, description, active, quantityInStock, replacementPrice, pendingAllocations, allocatedCount }` (`pendingAllocations` là 0 theo từng SKU). |
| `GET /technical/equipment/summary` | Technical, Admin | Tổng hợp `{ pendingFeasibleOrders }` đếm số đơn `Feasible` chưa cấp phát kết nối. |
| `GET /technical/incidents?settled=...` | Technical, Admin | Danh sách sự cố thiết bị hư hỏng `{ id, connectionId, accountId, customerName, customerPhone, productId, productName, incidentDate, description, replacementFee, recordedByUsername, settled }`. |
| `POST /technical/incidents` | Technical | `{ accountId, productId, description, replacementFee }` → 201 EquipmentIncident. Ghi nhận sự cố hư hỏng thiết bị, chi phí thay thế sẽ được tính vào hóa đơn cước kỳ tiếp theo. |

## Billing và Payment (Phòng Cước & Quầy Bán Lẻ)

### Billing Department (Role = Billing)

| Method và đường dẫn | Quyền | Kết quả |
| --- | --- | --- |
| `GET /billing/accounts?q=...&status=...&cityCode=...` | Billing | Danh sách tài khoản kết nối kèm chi tiết hóa đơn mới nhất, danh sách `invoices`, `payments`, `connectionStatus`, `refundStatus`, `refundAmount`, `refundedAt`. Hỗ trợ lọc theo từ khóa, trạng thái hóa đơn (`NotBilled`, `Unpaid`, `PartiallyPaid`, `Paid`, `RolledOver`) và thành phố. |
| `GET /billing/accounts/{accountId}` | Billing | Tra cứu chi tiết tài khoản theo 16 ký tự Account ID, trả về đầy đủ các mục chi phí (tiền cước gói, cước gọi Local/STD/Mobile, phí thiết bị hỏng, chiết khấu bulk, thuế dịch vụ 12.24%, tiền cọc hoàn lại, dư nợ cũ, tổng nợ, đã trả, còn nợ), lịch sử `invoices`/`payments` và trạng thái hoàn cọc (`connectionStatus`, `refundStatus`, `refundAmount`, `refundedAt`). |
| `POST /billing/accounts/{accountId}` | Billing | Tạo hóa đơn chu kỳ mới hoặc lập hóa đơn ban đầu. Body tùy chọn: `{ localMinutes, stdMinutes, mobileMinutes, equipmentFee, includeDeposit, periodStart, periodEnd }`. Cộng dồn `equipmentFee + unsettledIncidentFee`, kết chuyển các hóa đơn mở trước đó sang `RolledOver` (`dueAmount = 0`, gộp vào `previousDueBalance`), tính `periodEnd` mặc định theo `plan.validityMonths` (`1/3/6/12`), tính đủ cước thuê bao và thuế dịch vụ 12.24%; cọc thu riêng theo Order, `includeDeposit: true` trả 400. |
| `POST /billing/accounts/{accountId}/payment` | Billing | Ghi nhận thanh toán tại City Office (toàn bộ hoặc từng phần). Body tùy chọn: `{ amount, note }` (`amount > 0`, tối đa 2 chữ số thập phân). Trả 409 nếu chưa có hóa đơn hoặc hóa đơn ở trạng thái `RolledOver`. Ghi nhận người thu và kênh thanh toán `"CityOffice"`. |
| `POST /billing/accounts/{accountId}/refund` | Billing | Route cũ trả 409 và hướng dẫn dùng `/deposits/{orderId}/refunds` với chứng từ và khóa chống gửi trùng. Không giải ngân bằng route này. |

### Retail Outlet In-Store Billing & Payments (Role = Retail)

**Phạm vi lịch sử của BillingView:** `invoices` chứa tất cả bill của Account; `payments` chứa tất cả giao dịch thực lưu của các bill đó, gồm Paid/RolledOver, sắp `paidAt DESC, id DESC`. Các route Billing/Retail list/detail, Customer billing và response sau thu/lập bill có cùng phạm vi. `paidAmount`, `dueAmount`, `paidAt` ở cấp BillingView vẫn thuộc bill hiện tại, không phải tổng lịch sử. Để xem payment của riêng một bill, lọc theo `invoiceId`.

Payment trả `id`, `invoiceId`, `amount`, `paidAt` UTC, `paidByUsername` (username thực), `paidByDisplayName`, `channel`, `note`, `invoiceNumber`, `invoiceStatus`, `receiptCode`, `retailShopId`, `retailShopName`. `receiptCode` dạng `PAY-{id:D10}` là mã tra cứu từ payment đã lưu, không xác nhận thanh toán ngân hàng. Payment mới lưu RetailShopId của người ghi nhận; metadata lịch sử thiếu vẫn null/không ghi nhận, không gán ngược theo điểm bán hiện tại của nhân viên.

`paymentHistoryGaps` trả `{ invoiceId, invoiceNumber, recordedPaidAmount, recordedPaymentTotal }` khi PaidAmount của bill không khớp tổng payment. Không tự tạo payment từ Amount/PaidAt của bill để lấp thiếu. UI cảnh báo đối soát; tổng lịch sử chỉ tính payment thực. Không có thay đổi schema DB trong bản sửa lịch sử này.

Thu cước trực tiếp nhập lớn hơn Due trả 409, không tự giảm xuống Due. Khi lưu xung đột trả 409 yêu cầu tải lại lịch sử, không dùng khoản trả đủ của người khác làm bằng chứng thao tác này thành công. Direct payment chưa có operationId bền vững; sau mất phản hồi cần kiểm tra lịch sử trước khi gửi lại. [Kịch bản test và số tiền nhiều kỳ](payment-history-flow.md).

| Method và đường dẫn | Quyền | Kết quả |
| --- | --- | --- |
| `GET /retail/billing/accounts?q=...&status=...&cityCode=...` | Retail | Tra cứu danh sách tài khoản đã kết nối để phục vụ khách hàng thanh toán tại quầy bán lẻ. |
| `GET /retail/billing/accounts/{accountId}` | Retail | Xem chi tiết cước tính đến thời điểm hiện tại của thuê bao (till-date billing breakdown). |
| `POST /retail/billing/accounts/{accountId}/payment` | Retail | Thu tiền cước trực tiếp tại quầy bán lẻ (in-store retail counter). Body tùy chọn: `{ amount, note }`. Ghi nhận người thu và kênh thanh toán `"RetailOutlet"`. |

### Sổ cọc theo Order

| Method và đường dẫn | Quyền | Kết quả |
| --- | --- | --- |
| `GET /deposits?q=...` | Admin, Retail, Technical, Billing | Tối đa 100 sổ gần nhất, tìm Order ID/tên/điện thoại. Có snapshot cọc gốc, mức bulk, cọc phải thu, thực thu, đã hoàn, số dư, trạng thái đối soát và lịch sử giao dịch. |
| `GET /deposits/{code}` | Admin, Retail, Technical, Billing | Sổ cọc của Order trước hoặc sau kích hoạt; Account ID có thể null. |
| `POST /deposits/{code}/collections` | Retail, Billing | `{ amount, operationId, method, reference, note }`. Số tiền dương, tối đa hai chữ số thập phân. Chỉ thu sau Feasible, trước kích hoạt, không vượt phần còn phải thu; 409 nếu chưa đủ điều kiện hoặc còn cần đối soát. |
| `POST /deposits/{code}/refunds` | Billing | Cùng payload tiền. Chỉ hoàn sau Cancelled/NotFeasible/PermanentlyInactive; không vượt số dư thực giữ. Không tự cấn trừ nợ hoặc phí hỏng thiết bị. |
| `POST /deposits/{code}/reconcile` | Billing | `{ collectedAmount, refundedAmount, operationId, reference, note }`. Chỉ đối soát hồ sơ Legacy chưa rõ. Ghi tổng có chứng từ, không thu/hoàn tiền lần nữa; không được giảm tổng đã xác minh hoặc ghi hoàn vượt thu. Thu thừa trong lịch sử chỉ ghi khi có chứng từ, không nới giới hạn thu mới. |
| `POST /orders/{code}/cancel` | Retail | `{ reason }`. Hủy đơn chưa kích hoạt; giữ snapshot và tiền cọc đã thu, chặn kích hoạt. Gửi lại đơn đã hủy không thêm lịch sử hủy. |
| `GET /customer/deposits` | Customer | Chỉ sổ cọc của khách đang đăng nhập, không nhận customerId từ caller. Tài khoản bị vô hiệu hóa trả 403; khách không được gọi API giao dịch nhân viên. |

`method` của giao dịch mới thuộc `Cash`, `BankTransfer`, `Cheque`. `reference` và `note` bắt buộc; `operationId` dài 16–64 ký tự chữ/số/gạch ngang (UUID phù hợp). Gửi lại cùng ID/nội dung trả cùng kết quả, không ghi thêm giao dịch; đổi nội dung trên ID cũ trả 409. Biên nhận cùng Order/loại giao dịch không được ghi hai lần. Version của sổ cọc và trạng thái Order/Connection được kiểm tra trong cùng giao dịch DB để chặn ghi tiền dựa trên trạng thái đã lỗi thời.

Trạng thái sổ: `Uncollected`, `PartiallyCollected`, `Collected`, `Waived`, `RefundPending`, `Refunded`, `Closed`, `NeedsReconciliation`. `balance = collectedAmount - refundedAmount`; `refundableAmount` chỉ bằng số dư khi đã đóng và không cần đối soát. `remainingToCollect` bằng 0 với đơn đóng hoặc cần đối soát. `origin` là `Order` hoặc `Legacy`. Lịch sử có người thao tác, điểm bán, thời gian UTC, mã biên nhận và các tổng sau bản ghi; `sourceInvoiceId` đánh dấu phân bổ từ bill cũ.

**Chính sách hóa đơn cước mới:** `rentalAmount = snapshotPrice × connectionCount`; `subtotal = rentalAmount + callUsageAmount + equipmentFee`; `taxAmount = round(subtotal × 0.1224, 2)`; `totalAmount = subtotal + taxAmount + previousDueBalance`. `depositAmount`, `discountAmount`, `discountPercent` bằng 0 cho bill mới. Không giảm cước theo bulk. `includeDeposit` chỉ còn để trả lỗi rõ cho client cũ: true trả 400; false hoặc bỏ qua đều không cộng cọc.

Ví dụ 10 đường BB Basic: sổ cọc riêng gốc 5.000, giảm 25% là 1.250, phải thu 3.750 USD; hóa đơn cước là 2.525,40 USD. Nếu gói có policy advance, thu/phân bổ theo sổ riêng bên dưới; không cộng advance thành phụ phí. Thuế cọc vẫn là giả định cần xác nhận; luồng hiện tại không tính thuế cọc.

Đọc/thu tiền trên hóa đơn cũ sử dụng số tiền đã lưu, không tính lại theo chính sách mới. Những bill này có thể còn `depositAmount` hoặc giảm cước lịch sử; nhãn hiển thị là `Recorded Discount` và `Deposit included in this invoice`. Backfill chỉ ghi tiền cọc đã thu khi có chứng từ thanh toán đầy đủ khớp một bill; các trường hợp còn lại cần đối soát. `refundStatus`/`refundAmount` của tài khoản là thông tin tương thích suy ra từ sổ cọc; `NeedsReconciliation` có số có thể hoàn bằng 0. Sau hoàn hết, `refundAmount` hiển thị tổng đã hoàn; khi còn chờ hoàn nó hiển thị số dư còn có thể hoàn.

Luồng diễn tập và kiểm thử: [Thu và hoàn tiền đặt cọc](deposit-flow.md).

Các POST thanh toán cước trực tiếp hỗ trợ gửi kèm body JSON hoặc body trống (mặc định lấy toàn bộ số dư còn nợ). Trạng thái hóa đơn chuyển từ `NotBilled → Unpaid / PartiallyPaid → Paid` (hoặc `RolledOver` khi phát hành kỳ mới). Ngoài `"CityOffice"` và `"RetailOutlet"`, thanh toán trực tuyến từ Customer Portal (`POST /customer/billing/{accountId}/payments`) ghi nhận `PaymentTransaction.Channel = "CustomerPortal"`; phân bổ advance dùng `"Advance"`.

### Sổ advance và phân bổ thanh toán

Đề không cung cấp mức advance gốc. Chính sách nhóm: Admin cấu hình `advancePerConnection` nullable trên payload tạo/sửa Plan; GET plans và public/plans trả cùng trường. Null/bỏ qua = chưa có policy, 0 = không yêu cầu, số dương = mức tùy chọn mỗi đường trước bulk (tối đa 999.999,99 USD, hai chữ số thập phân). Khi PUT cần gửi lại policy muốn giữ. Seed để null; xác nhận Request chốt snapshot trên Order, không hồi tố theo thay đổi gói.

| Method và đường dẫn | Quyền | Request và kết quả |
| --- | --- | --- |
| `GET /advances?q=...` | Admin, Retail, Technical, Billing | Tối đa 100 sổ gần nhất; tìm Order/Account/tên/điện thoại; snapshot báo giá, thực nhận, đã phân bổ, đã hoàn, số dư, bill mở và lịch sử |
| `GET /advances/{code}` | Admin, Retail, Technical, Billing | Chi tiết sổ theo Order ID, Account có thể null |
| `POST /advances/{code}/collections` | Retail, Billing | `{ amount, operationId, method, reference, note }`. Nhận thực tế sau Feasible hoặc Connected, trước đóng; không vượt báo giá còn chưa thu. Không bắt buộc để kích hoạt; có thể thu phần còn lại sau kích hoạt |
| `POST /advances/{code}/allocations` | Billing | `{ invoiceId, amount, operationId, reference, note }`. Chọn bill Unpaid/PartiallyPaid của chính Account; số tiền không vượt credit thực còn và Due. Ghi payment Channel Advance cùng giao dịch ledger, cập nhật Paid/Due/status; giữ nguyên phí, thuế và total |
| `POST /advances/{code}/refunds` | Billing | Payload giống collections. Hoàn tối đa số dư thực chưa dùng sau Cancelled/NotFeasible/PermanentlyInactive; không hoàn phần đã phân bổ, không tự trừ nợ hoặc sửa cọc |
| `GET /customer/advances` | Customer | Chỉ sổ của khách đang đăng nhập, không nhận customerId; khách chỉ đọc, không được gọi giao dịch nhân viên |

Thu/hoàn dùng `Cash | BankTransfer | Cheque`; allocation ghi phương thức `AdvanceCredit`. Tất cả POST sổ advance bắt buộc amount dương hai chữ số thập phân, operationId, reference và note; quy tắc ID/chứng từ giống sổ cọc. Cùng ID/cùng nội dung/cùng actor trả sổ mới nhất mà không thêm payment hoặc tiền; khác nội dung trả 409. Không có API khách tự nạp advance hoặc tự xác nhận đã trả tiền.

`AdvanceView` gồm `orderId`, `accountId`, `customerName`, `orderStatus`, `connectionStatus`, `perConnectionAmount`, `grossAmount`, `discountPercent`, `quotedAmount`, `receivedAmount`, `allocatedAmount`, `refundedAmount`, `availableAmount`, `remainingToCollect`, `refundableAmount`, `status`, `origin`, `openInvoices`, `transactions`. `availableAmount = receivedAmount - allocatedAmount - refundedAmount`; refundable chỉ mở sau đóng, remainingToCollect bằng 0 khi đóng. `openInvoices` có id/number/totalAmount/dueAmount/status; transaction lưu actor, shop, UTC, reference/note/method, số dư sau giao dịch và invoiceId/paymentId nếu là allocation.

Trạng thái: `NotConfigured`, `NotRequired`, `Waived`, `Uncollected`, `PartiallyCollected`, `Available`, `FullyAllocated`, `RefundPending`, `Refunded`, `Closed`. Miễn 100% tạo quote 0 và credit 0, không miễn rental. Không tự dùng credit khi lập bill; nếu chuyển kỳ chỉ kết chuyển Due còn lại, không dùng lại payment Advance của bill cũ. Bill RolledOver/Paid hoặc vượt số dư trả 409; bill khác Account trả 404.

Save nguyên tử và concurrency kiểm tra version sổ, trạng thái Order/Connection, Invoice.Status/PaidAt/PaidAmount/DueAmount. Allocation cạnh tranh refund/payment trực tiếp/chuyển kỳ không thể làm mất tiền hoặc thêm payment khi ledger không commit. Legacy chỉ tạo sổ policy null, các tổng 0; không tự chuyển cọc hoặc payment bill thành advance. [Luồng và 14 bước test](advance-flow.md).

## Vòng Đời Kết Nối & Tìm Kiếm Nâng Cao 5 Tiêu Chí (Group 3)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /connections?q=...&code=...&customerName=...&serviceType=...&phone=...&fromDate=...&toDate=...&status=...&cityCode=...` | Retail, Technical, Admin | Danh sách kết nối kèm trạng thái vòng đời (`Active`, `TemporarilyInactive`, `PermanentlyInactive`), thông tin hoàn cọc và tìm kiếm kết hợp 5 tiêu chí (`serviceType` hỗ trợ `D/B/T` hoặc tên dịch vụ; `fromDate`/`toDate` chuẩn UTC nửa mở `[fromUtc, toExclusiveUtc)`). |
| `GET /connections/{accountId}` | Retail, Technical, Admin | Chi tiết kết nối theo 16 ký tự Account ID, bao gồm lịch sử trạng thái, gói cước, thiết bị cấp phát và thông tin hoàn cọc. |
| `POST /technical/connections/{accountId}/suspend` | Technical | `{ reason }` → 200 Connection. Chuyển trạng thái từ `Active` sang `TemporarilyInactive`. |
| `POST /technical/connections/{accountId}/reactivate` | Technical | Body trống → 200 Connection. Khôi phục kết nối từ `TemporarilyInactive` về `Active`. |
| `POST /technical/connections/{accountId}/terminate` | Technical | `{ note }` → PermanentlyInactive; số dư cọc thực giữ trở thành có thể hoàn nếu đã đối soát. Không giải ngân và không tự trừ nợ/phí hỏng; Billing hoàn qua sổ cọc. |
| `GET /orders/search?code=...&customerName=...&serviceType=...&phone=...&fromDate=...&toDate=...&status=...` | Retail, Technical, Admin | Tìm kiếm đơn hàng nâng cao kết hợp 5 tiêu chí (Mã Order ID/Account ID, Tên khách hàng, Loại dịch vụ `D/B/T` hoặc tên dịch vụ, Khoảng ngày UTC `fromDate`–`toDate`, Số điện thoại). |

## Hồ Sơ Chứng Từ Khách Hàng, Đổi Gói Cước & Hỏi Đáp / FAQ Động (Group 4)

### Lưu Trữ Hồ Sơ Chứng Từ Khách Hàng (Customer Documents)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /documents?year=...&cityCode=...&customerId=...&documentType=...` | Retail, Admin | Danh sách chứng từ lưu trữ được lập chỉ mục theo Năm (`year`), Khu vực (`cityCode`), Khách hàng và Loại chứng từ (`AddressProof`, `RegistrationForm`, `PaymentReceipt`, `Other`). |
| `POST /documents` | Retail, Admin | Hỗ trợ `multipart/form-data` (`file`, `customerId`, `documentType`, `title`, `year`, `cityCode`) lưu tệp vật lý trên đĩa cục bộ hoặc JSON `{ customerId, documentType, title, filePathOrUrl, year, cityCode }` (`filePathOrUrl` bắt buộc là URL `http(s)://` hợp lệ hoặc đường dẫn tương đối an toàn có đuôi tệp thuộc danh sách cho phép) → 201 CustomerDocument. |
| `GET /documents/{id}/download?inline=...` | Retail, Admin | Tải xuống hoặc xem trực tiếp (`inline=true`) tệp chứng từ vật lý đã lưu trữ. |

### Yêu Cầu Đổi Gói Cước (Plan Change Requests)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /plan-changes?status=...&connectionId=...` | Retail, Technical, Admin | Danh sách yêu cầu đổi gói cước (`Pending`, `Approved`, `Rejected`), kèm `requestedById` (bao gồm cả yêu cầu do khách hàng gửi từ `/customer/plan-changes` với `requestedById` là `Employee.Id` của tài khoản `Customer`). |
| `POST /plan-changes` | Retail, Admin | `{ connectionId, targetPlanId, note }` → 201 PlanChangeRequest (kèm `requestedById`). Chỉ cho phép kết nối đang `Active` đổi sang gói mới cùng loại dịch vụ (`D/B/T`, trả 400 nếu khác loại) và chặn trùng yêu cầu `Pending` (409). |
| `POST /plan-changes/{id}/approve` | Admin, Technical | Body trống → 200 PlanChangeRequest. Kiểm tra lại kết nối vẫn `Active` (409), gói đích vẫn `Active` (409) và cùng loại dịch vụ (400), sau đó cập nhật gói cước hiệu lực của thuê bao. |
| `POST /plan-changes/{id}/reject` | Admin, Technical | Body tùy chọn `{ note }` → 200 PlanChangeRequest. Từ chối yêu cầu đổi gói cước. |

### Hỏi Đáp Khách Hàng & Danh Mục FAQ Động (Customer Queries & FAQ)

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /queries?status=...&category=...&customerId=...` | Retail, Admin | Danh sách câu hỏi/thắc mắc của khách hàng (`Open`, `Answered`, `Closed`) theo danh mục (`Billing`, `Technical`, `Plan`, `General`), kèm `createdById`, `closedAt`, `closedById` (bao gồm cả câu hỏi do khách hàng gửi từ `/customer/queries` với `createdById` là `Employee.Id` của tài khoản `Customer`). |
| `POST /queries` | Retail, Admin | `{ customerId, subject, category, question }` → 201 CustomerQuery (lưu `createdById`). |
| `POST /queries/{id}/answer` | Retail, Admin | `{ answer, isFaq }` → 200 CustomerQuery. Trả lời thắc mắc và tùy chọn xuất bản lên danh mục FAQ động (`isFaq: true`). |
| `POST /queries/{id}/close` | Retail, Admin | Body trống → 200 CustomerQuery. Đóng yêu cầu hỗ trợ và ghi nhận `closedById`, `closedAt`. |
| `GET /faq?category=...` | Công khai / Đã đăng nhập (bao gồm `Customer`) | Danh sách các câu hỏi thường gặp (FAQ) đã được trả lời và gắn cờ `isFaq = true`. |

## Cổng Thông Tin Khách Hàng (Customer Portal — Role = `Customer`)

Nhóm route `/customer/*` yêu cầu phiên đã đăng nhập với vai trò `Customer` (`Roles.Customer`, nhân viên `Roles.Staff` nhận `403`). Mọi request đều đi qua kiểm tra cơ sở dữ liệu trực tiếp (`RequireCustomerActorAsync`):

- Thiếu phiên hợp lệ, không phải vai trò `Customer` hoặc chưa liên kết `CustomerId` → `401 Unauthorized`.
- Tài khoản đăng nhập bị vô hiệu hóa (`Employee.Active == false`) → `403 Forbidden` ProblemDetails (`"Customer login is deactivated."`) cho **cả GET (đọc) lẫn PUT/POST (ghi)**.
- Hồ sơ khách hàng bị tạm ngưng (`Customer.Status == "SUSPENDED"`) → **`200 OK` cho các lệnh `GET`** (trả về `status: "SUSPENDED"` trong `CustomerProfileView`) và **`403 Forbidden` ProblemDetails (`"Customer account is suspended."`) cho mọi lệnh `PUT`/`POST`**.
- Cô lập dữ liệu theo chủ sở hữu (IDOR protection): truy cập `orderCode`, `connectionId`, `accountId` hoặc `invoiceId` không thuộc khách hàng hiện tại trả **`404 Not Found`**.
- Mọi request `PUT`/`POST` bắt buộc kèm header `X-CSRF-Token` hợp lệ (`400` nếu thiếu/sai).

| Method và đường dẫn | Quyền | Request, validation và response |
| --- | --- | --- |
| `GET /customer/profile` | Customer | `200 CustomerProfileView` (`{ id, code, name, phone, address, cityCode, taxId, email, contactPerson, customerType, status, username, active }`). `401`, `403` nếu `!employee.Active`. |
| `PUT /customer/profile` | Customer | `{ name, phone, address, cityCode, email?, contactPerson?, taxId?, customerType? }` (`name` ≤ 120 không rỗng, `phone` `^\+?[0-9]{7,15}$`, `address` ≤ 240 không rỗng, `cityCode` `^[0-9]{3}$` tồn tại, `email` ≤ 160, `contactPerson` ≤ 120, `taxId` ≤ 32, `customerType` ≤ 40). Giữ nguyên `status`, đồng bộ `employee.DisplayName` (cắt tối đa 100 ký tự) → `200 CustomerProfileView` (`400`, `401`, `403`). |
| `GET /customer/requests` | Customer | `200 RequestView[]` tối đa 100 yêu cầu thuộc khách hàng hiện tại (mới nhất trước). `401`, `403` nếu `!employee.Active`. |
| `POST /customer/requests` | Customer | `{ planId, hasNexusLandline, connectionCount?, address?, cityCode? }` (`connectionCount` `1..10000` mặc định `1`; `address`/`cityCode` mặc định lấy từ hồ sơ khách hàng; gói phải `active = true`; `retailShopId = null`; chỉ bật `hasNexusLandline` khi gói loại `D`; tích hợp chiết khấu đặt cọc số lượng 25%–100% khi `connectionCount >= 10`) → `201 RequestView` (`400`, `401`, `403`). |
| `GET /customer/orders` | Customer | `200 OrderView[]` tối đa 100 đơn hàng của khách hàng hiện tại. `401`, `403` nếu `!employee.Active`. |
| `GET /customer/orders/{code}` | Customer | `200 OrderDetailView` (`{ order, history, feedback, planId, planName, snapshotPrice }`). `401`, `403` nếu `!employee.Active`, `404` nếu mã không hợp lệ hoặc đơn thuộc khách khác. |
| `POST /customer/orders/{code}/feedback` | Customer | `{ rating, comment }` (`rating` `1..5`, `comment` bắt buộc không rỗng ≤ 600) → `201 CreatedFeedback` (`{ id, rating, comment, createdAt }`). Trả `400` nếu dữ liệu không hợp lệ/comment rỗng, `404` nếu không tìm thấy/thuộc khách khác, `409` nếu đơn chưa `Connected` hoặc đã có phản hồi trước đó. |
| `GET /customer/connections` | Customer | `200 ConnectionLifecycleView[]` tối đa 100 kết nối của khách hàng hiện tại. `401`, `403` nếu `!employee.Active`. |
| `GET /customer/billing` | Customer | `200 BillingView[]` cho các đơn `Connected` của khách hàng hiện tại, gồm chi tiết thuế/chiết khấu/đặt cọc, danh sách `invoices[]`, `payments[]`, `connectionStatus`, `refundStatus`, `refundAmount`, `refundedAt`. `401`, `403` nếu `!employee.Active`. |
| `POST /customer/billing/{accountId}/payments` | Customer | Body JSON tùy chọn `{ invoiceId?, amount?, note? }` (body rỗng thanh toán toàn bộ `dueAmount` của hóa đơn mới nhất; `amount > 0` tối đa 2 chữ số thập phân và tự giới hạn theo `dueAmount`; `note` ≤ 250). Gọi `BillingService.PayAsync` ghi nhận `PaymentTransaction.Channel = "CustomerPortal"` → `201 BillingView`. Trả `400` (dữ liệu sai), `401`/`403`, `404` nếu `accountId` hoặc `invoiceId` không tồn tại/thuộc khách khác, `409` nếu chưa có hóa đơn, hóa đơn ở trạng thái `RolledOver`, hoặc `invoiceId` không phải hóa đơn mới nhất đang hiệu lực. |
| `GET /customer/plan-changes` | Customer | `200 PlanChangeRequestView[]` tối đa 100 yêu cầu đổi gói của khách hàng hiện tại. `401`, `403` nếu `!employee.Active`. |
| `POST /customer/plan-changes` | Customer | `{ connectionId, targetPlanId, note? }` (`note` ≤ 500). Kiểm tra kết nối thuộc khách hàng (`404` nếu không), ủy quyền `OperationsService.SubmitPlanChangeAsync` với `requestedById = employee.Id` (kết nối phải `Active` → `409`, gói đích phải tồn tại `404` và `active = true` → `400`, cùng loại dịch vụ `D/B/T` → `400`, khác gói hiện tại → `400`, không trùng yêu cầu `Pending` → `409`) → `201 PlanChangeRequestView`. |
| `GET /customer/queries` | Customer | `200 CustomerQueryView[]` tối đa 100 câu hỏi hỗ trợ của khách hàng hiện tại. `401`, `403` nếu `!employee.Active`. |
| `POST /customer/queries` | Customer | `{ subject, category, question }` (`subject` ≤ 200 không rỗng, `category` thuộc `Billing \| Technical \| Plan \| General`, `question` ≤ 1000 không rỗng). Ủy quyền `OperationsService.CreateQueryAsync` gắn `customerId` của phiên và `createdById = employee.Id` → `201 CustomerQueryView` (`400`, `401`, `403`). |

```text
CustomerRegistrationView { customerId, customerCode, username, displayName, role }
CustomerProfileView      { id, code, name, phone, address, cityCode, taxId, email,
                           contactPerson, customerType, status, username, active }
```

Các endpoint `/customer/*` tái sử dụng trực tiếp các DTO chuẩn của hệ thống (`RequestView`, `OrderView`, `OrderDetailView`, `CreatedFeedback`, `ConnectionLifecycleView`, `BillingView` kèm `invoices[]`/`payments[]`, `PlanChangeRequestView`, `CustomerQueryView`).

## Public tracking & Catalog

| Method và đường dẫn | Quyền | Request và response |
| --- | --- | --- |
| `GET /public/plans` | Công khai | Danh sách `PlanView[]` các gói cước đang hoạt động (`active = true`) phục vụ trang chủ công khai. |
| `GET /public/cities` | Công khai | Danh sách `{ code, name }` các thành phố/mã vùng 3 chữ số phục vụ form tự đăng ký `/register`. |
| `POST /register` | Công khai | Tự đăng ký tài khoản khách hàng. Áp dụng giới hạn tần suất `"login"` (`12` req/phút/IP → `429`) và kiểm tra `X-CSRF-Token` (`400`). Body: `{ name, phone, address, cityCode, username, password, email?, contactPerson?, taxId?, customerType? }` (`name` ≤ 120 không rỗng, `phone` `^\+?[0-9]{7,15}$`, `address` ≤ 240 không rỗng, `cityCode` `^[0-9]{3}$` tồn tại, `username` `^[a-zA-Z0-9._-]{3,40}$` chuẩn hóa chữ thường và từ chối `^cus-[0-9]+$` → `400`, `password` `12..128` ký tự không toàn khoảng trắng, `email` ≤ 160, `contactPerson` ≤ 120, `taxId` ≤ 32, `customerType` ≤ 40 mặc định `"Individual"`). Tạo ngay `Customer` (`Status = "ACTIVE"`) và `Employee` (`Role = "Customer"`, `Active = true`, `DisplayName` cắt tối đa `100` ký tự từ `name`), cấp cookie phiên `Nexus.Session` tức thì và trả `201 CustomerRegistrationView`. Trùng `username` trả `409 Conflict`. Client cần đọc lại `GET /session` sau khi đăng ký thành công. |
| `GET /public/track/order/{code}` | Công khai | Trạng thái order, service type, city và Account ID nếu đã connected. |
| `GET /public/track/account/{accountId}` | Công khai | Trả `{ type, id, orderId, serviceType, status, cityCode, accountId, dueAmount }`, trong đó `status` phản ánh trạng thái kết nối thực tế (`Active`, `TemporarilyInactive`, `PermanentlyInactive`) và `dueAmount` là tổng dư nợ mở (`Unpaid`/`PartiallyPaid`). |

Public tracking chỉ trả trạng thái, loại dịch vụ, mã thành phố và mã tham chiếu. Tên và địa chỉ khách hàng chỉ xuất hiện trong các API nội bộ có phân quyền hoặc API `/customer/*` của chính chủ sở hữu.

## Phân quyền tổng hợp, Tài khoản Demo & Mã lỗi

- **Phân tách vai trò (`Roles.Staff` vs `Roles.Customer`):**
  - `Roles.Staff` (`Admin`, `Retail`, `Technical`, `Billing`): được truy cập các route nghiệp vụ nội bộ theo từng phòng ban (bao gồm `GET /retail-shops`), nhưng nhận `403` trên `/customer/*`.
  - `Roles.Customer` (`Customer`): được truy cập `/session`, `/logout`, `/cities`, `/plans` (chỉ gói `active = true`), `/faq`, `/public/*` và toàn bộ `/customer/*`; bị chặn với `403 Forbidden` trên mọi route nhân viên (kể cả `GET /retail-shops`).
- **Tài khoản Demo mặc định (`--demo`, mật khẩu `Nexus-Demo-2026!`):** 4 tài khoản nhân viên (`admin.demo`, `retail.demo`, `technical.demo`, `billing.demo`) và 1 tài khoản khách hàng (`customer.demo`, `role = "Customer"`, liên kết `CUS-000001` — `Trần Minh B`, `status = "ACTIVE"`).
- **Tổng hợp mã lỗi HTTP:**
  - `400`: Dữ liệu đầu vào không hợp lệ, `username` trùng mẫu đặt trước `^cus-[0-9]+$`, thiếu/sai `X-CSRF-Token`, hoặc vi phạm bất biến `Customer` trên `PUT /employees/{id}`.
  - `401`: Chưa đăng nhập, sai thông tin đăng nhập, hoặc tài khoản nhân viên bị vô hiệu hóa (`active = false`).
  - `403`: Sai vai trò (`Customer` gọi route nhân viên hoặc nhân viên gọi `/customer/*`), hoặc ProblemDetails khi tài khoản `Customer` bị vô hiệu hóa (`"Customer login is deactivated."`) / hồ sơ `Customer` bị tạm ngưng (`"Customer account is suspended."`).
  - `404`: Không tìm thấy bản ghi, hoặc truy cập chéo tài nguyên của khách hàng khác trên `/customer/*` (IDOR).
  - `409`: Xung đột trạng thái/bước xử lý, trùng dữ liệu (`username`, phản hồi đơn hàng thứ 2 trên `/customer/orders/{code}/feedback`), thanh toán hóa đơn `RolledOver`/không phải kỳ mới nhất, tự vô hiệu hóa hoặc hạ quyền `Admin` cuối cùng, hay xung đột cập nhật đồng thời.
  - `429`: Vượt giới hạn tần suất `"login"` (`12` yêu cầu/phút/IP) trên `POST /login` hoặc `POST /register`.
