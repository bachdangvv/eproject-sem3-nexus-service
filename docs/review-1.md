# Kịch bản Review 1 Nexus

Dùng API mode mặc định. Chạy FE và BE theo [README](../README.md), rồi mở [trang đăng nhập](http://localhost:5173/login). Cả bốn tài khoản seed dùng mật khẩu demo cục bộ `Nexus-Demo-2026!`. Nút **Sign out** giúp đổi vai trò giữa các bước.

## Chuẩn bị

- Dùng database demo sạch hoặc cấu hình `ConnectionStrings__Demo` trỏ tới một file SQLite mới dành riêng cho rehearsal. API tự chạy migration và seed khi khởi động.
- Gói seed cho luồng chính là **BB Basic**, giá **225 USD**. Khách mẫu mới dùng tên **Nguyễn Văn A**, điện thoại **0900000001**, địa chỉ **10 Nexus Street**, City **101**, email **review1@example.vn**.
- Chạy `npm test --prefix frontend`, `npm run build --prefix frontend`, `dotnet build backend/Nexus.slnx` và `./backend/scripts/smoke.ps1` bằng PowerShell 7. Smoke test dùng SQLite riêng.

## Luồng trình bày 6–8 phút

| Người trình bày | Vai trò và thao tác | Kết quả cần thấy |
| --- | --- | --- |
| Minh | **Admin** (`admin.demo`). Mở **Plans & Tariffs**, chỉ gói BB Basic rồi thêm sản phẩm `Review 1 Router`. Trong **Access Control & RBAC**, tạo một tài khoản Retail nếu cần trình bày T15. | Gói ở trạng thái active. Sản phẩm hiện trong catalog. Admin thấy username và role vừa tạo. |
| Bách | **Retail** (`retail.demo`). Mở **Customers → New customer**, nhập dữ liệu mẫu. Sau khi lưu, dùng **Find customer** với mã vừa cấp. | Khách có mã `CUS-000002` trên DB sạch. Địa chỉ và số điện thoại đọc lại đúng. |
| Bách | Mở **Create New Subscription**, chọn khách và **BB Basic**, bấm **Save request** rồi **Confirm request** trong hàng chờ. | Có Request trước khi có Order. Sau khi confirm, chép Order ID `B0000000001` và thấy trạng thái **Pending**. |
| Nhật | **Technical** (`technical.demo`). Mở **ODN Feasibility Surveys**, chọn Order ID vừa tạo, giữ **Distance within limit** và **Server available**, bấm **Save assessment**. Mở **Circuit Activation & Commissioning**, chọn lại đơn và bấm **Create connection**. | Lịch sử **Pending → Feasible → Connected**. Chép Account ID `B101000000000001`. |
| Nhật | **Billing** (`billing.demo`). Dán Account ID tại **Billing & payment → Find account**. Bấm **Create billing record → Record full manual payment**. Tải lại và tìm lại Account ID. | Đúng Order ID, khách và giá **225.00 USD**. Trạng thái **Not billed → Unpaid → Paid**, có thời điểm thanh toán. |
| Bách | Vào lại **Retail → Orders**, tìm đúng Order ID. Gửi **Feedback** 5/5 với nội dung `Kết nối hoạt động ổn định`. Tải lại chi tiết đơn. | Phản hồi vẫn có trong Order đã Connected. |
| Cả nhóm | Mở **Tracking** trên trang chủ và lần lượt nhập Order ID, Account ID. | Tra được cả hai mã và trạng thái kết nối. Tên và địa chỉ khách không xuất hiện trên tracking công khai. |

Mã trên là ví dụ khi đây là Order và Connection đầu tiên. Khi rehearsal trên database đã dùng, sao chép mã hệ thống vừa trả về.

## Nhánh kiểm thử và đóng review

- Tạo Request **Dial-up 10h** cho khách chưa có Nexus landline. Technical bỏ chọn **Landline feasible**, nhập lý do rồi lưu. Xác nhận trạng thái **Not feasible**, lý do còn trong lịch sử và màn Connections không có nút cấp kết nối cho đơn đó.
- Admin sửa rồi archive sản phẩm thử. Tạo nhân viên Retail với mật khẩu từ 12 ký tự, sau đó thử đăng nhập bằng nhân viên đó. Retail không được gọi API Admin. Billing chỉ làm việc với Account ID đã được cấp.
- Sau rehearsal, cả nhóm ghi commit, người chạy, môi trường, kết quả và lỗi còn mở vào biên bản. Chốt blocker khi chạy lại được bước lỗi trên cùng bản demo.

## Kết quả chạy thử 16/11/2026

- Frontend build/test, backend build và smoke test trên SQLite sạch đều đạt.
- Lượt kiểm tra bằng trình duyệt đã tạo và tra cứu khách, xác nhận hai Request, cấp Connection cho Broadband và từ chối Dial-up có lý do. Broadband trả Order `B0000000001`, Account `B101000000000001`. Billing báo `Paid` sau khi tải lại. Feedback cũng còn sau khi tải lại Order. Public tracking tìm được cả hai mã.
- Admin tạo, sửa và ngừng dùng Plan/Product. Nhân viên Retail vừa tạo đăng nhập được. Migration SQL Server xuất được script, còn chạy thử nghiệp vụ dùng SQLite.
- Hai lỗi đã xử lý trong lượt chuẩn bị là màn Orders đọc trường liên hệ thiếu và màn Activation đòi dữ liệu kho khi cấp Connection. Nhóm dùng bảng trên để phân vai và diễn tập phần thuyết trình.

Review 1 ghi nhận thanh toán toàn phần thủ công trên một billing record cho mỗi Connection. Cổng thanh toán, hóa đơn định kỳ, upload hồ sơ, cấp phát thiết bị và cổng khách hàng thuộc scope sau.

Ảnh lịch sử từ prototype ngày 11/11/2026 nằm trong [evidence](evidence/).
