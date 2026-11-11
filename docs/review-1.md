# Kịch bản Review 1 Nexus

Ngày review theo bảng nhóm là **16/11/2026**. Luồng demo 5–7 phút đi từ đăng nhập Retail, ghi yêu cầu, xác nhận đơn đến đăng nhập Technical, đánh giá và sinh Account ID. Hóa đơn, thanh toán, mua hàng vendor, upload hồ sơ và cổng tự phục vụ dành cho khách hàng thuộc các giai đoạn sau.

Các bước trên giao diện và ảnh dưới đây ghi lại prototype đã chạy ngày 11/11/2026. Bản hiện tại cung cấp [API](api.md) để thành viên phụ trách triển khai các màn hình tương ứng bằng React và Vite. Có thể chạy smoke test backend theo [README](../README.md) trong thời gian tích hợp giao diện.

## Dữ liệu và trình tự

Dùng database vừa reset theo [README](../README.md). Đăng nhập bằng `retail.demo` hoặc `technical.demo`, dùng mật khẩu demo trong README.

| Bước | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Đăng nhập Retail. Thêm Nguyễn Văn A, số `0900000001`, địa chỉ `10 Nexus Street`, City `101`. | Màn Retail hiện khách hàng `CUS-000002`. |
| 2 | Chọn **Tạo yêu cầu**, gói **BB Basic** và **Lưu yêu cầu**. | Yêu cầu #1 xuất hiện trong hàng chờ. |
| 3 | Chọn **Xác nhận thành đơn**. | Đơn `B0000000001` ở `Pending`. |
| 4 | Đăng xuất và vào Technical. | Hàng chờ `Pending` hiển thị đơn vừa tạo. |
| 5 | Mở đơn, chọn **Đạt** cho khoảng cách và máy chủ, lưu đánh giá. | Đơn chuyển sang `Feasible` và có mục lịch sử tương ứng. |
| 6 | Chọn **Tạo kết nối**. | Đơn chuyển sang `Connected`, Account ID là `B101000000000001`. |
| 7 | Nếu còn thời gian, quay lại Retail, tra cứu bằng Order ID. | Có Account ID và lịch sử `Pending → Feasible → Connected`. |

Để trình bày nhánh từ chối, tạo thêm một yêu cầu Dial-up với khách chưa có điện thoại Nexus. Tại Technical chọn đường dây **Không đạt** và ghi lý do. Đơn chuyển sang `Not Feasible`, nút cấp kết nối không xuất hiện.

## Phân công theo tab Demo Flow

Bách trình bày đăng nhập Retail. Minh trình bày tạo khách hàng, Request, xác nhận Order và Order ID. Nhật trình bày hàng chờ, đánh giá, cấp Connection và Account ID. Ba bạn cùng phụ trách reset dữ liệu và chạy rehearsal.

## Tiêu chí nghiệm thu

- Retail, Technical, Admin và Billing đăng nhập bằng tài khoản riêng. Người dùng chỉ gọi được thao tác được cấp quyền.
- Admin thêm, sửa, ngừng dùng gói và thiết bị. Retail chỉ thấy gói đang hoạt động.
- Retail tạo, sửa và tra cứu Customer. Chỉ Request đã xác nhận mới có Order ID.
- Technical chỉ cấp kết nối sau `Feasible`. Nhánh Dial-up kiểm tra đường dây khi cần.
- Order ID có 11 ký tự. Account ID có 16 ký tự. Xác nhận hoặc cấp kết nối lại cho cùng bản ghi không tạo thêm Order hoặc Connection.
- Lịch sử hiển thị người thao tác, thời điểm và kết quả. Retail ghi phản hồi sau khi đã cấp kết nối.

## Giả định sử dụng trong bản demo

Bản Review 1 dùng format 16 ký tự theo phần Proposed Solution và tab Demo Flow. Retail nhập yêu cầu thay mặt khách tại cửa hàng, sau đó xác nhận thành Order. Gói BB Basic dùng giá mẫu 225 USD/tháng theo mức Broadband 64 Kbps trong đề. Các mốc giảm giá chồng nhau trong đề và giá thuê bao còn thiếu cần được chốt trước khi lập hóa đơn.

## Kết quả chạy thử ngày 11/11/2026

Build .NET thành công. Smoke test trên SQLite sạch đạt 22 nhóm kiểm tra, gồm migration, seed, đăng nhập bốn vai trò, ràng buộc quyền, validation, luồng Broadband, nhánh Dial-up bị từ chối và phản hồi theo Order. Phát hiện và đã sửa lỗi khóa ngoại khiến lịch sử trạng thái không xuất hiện trên đơn. Migration SQL Server tạo được script SQL idempotent. Lượt kiểm tra này chạy với SQLite.

| Bước đã chạy trên trình duyệt | Bằng chứng |
| --- | --- |
| Retail tạo khách hàng và Request | [Ảnh hàng chờ yêu cầu](evidence/01-retail-request.png) |
| Retail xác nhận thành Order | [Ảnh Order Pending](evidence/02-order-pending.png) |
| Technical mở hàng chờ | [Ảnh Technical Queue](evidence/03-technical-queue.png) |
| Technical lưu kết quả khả thi | [Ảnh Order Feasible](evidence/04-order-feasible.png) |
| Technical cấp kết nối và kiểm tra Account ID | [Ảnh Order Connected](evidence/05-connection-account.png) |

Nhóm còn lượt rehearsal theo phân công và cần xác nhận môi trường dùng chung trước buổi review.
