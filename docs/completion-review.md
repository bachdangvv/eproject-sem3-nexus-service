# Đánh giá lại mức độ hoàn thiện — 25/11/2026

> **Đính chính sau khi đối chiếu sheet 38 đầu việc:** [Bản verified theo từng task](task-sheet-verification.md) ghi nhận **11 đạt, 25 một phần, 2 chưa xác minh**. Đã tái hiện thêm B01 migration từ schema Review1Billing làm mất BillingRecords, B02 phát hành trùng kỳ, B03 retry thu cước một phần tạo thêm payment và B04 public tracking trả dư nợ trái ghi chú của sheet. Các ước lượng 97%/88% bên dưới là đánh giá trước lượt audit này, chưa bao phủ các ca không đạt vừa nêu; cần chấm lại sau khi xử lý blocker, không dùng làm tỷ lệ task đã nghiệm thu. Kiểm thử legacy trước đây bắt đầu từ schema 20261121, sau migration FinancialBilling, nên đã bỏ sót đường chuyển dữ liệu cũ này.

## Phạm vi và cách đánh giá

Đối chiếu code hiện tại, README, kịch bản Review 1, đề nghiệp vụ `NEXUS SERVICE MARKETING SYSTEM.doc` và tài liệu bàn giao `Project Specification - NEXUS SERVICE MARKETING SYSTEM.DOC` trong ZIP người dùng cung cấp. Đề không có rubric chấm điểm riêng cho Review 1/2; vì vậy đây là **ước lượng kỹ thuật**, không phải điểm chính thức của giảng viên.

- **Review 1: khoảng 97%**, nên hiểu là dải 95–98% đối với luồng cơ bản trong `docs/review-1.md`.
- **Review 2: khoảng 88% chức năng**, dải hợp lý 85–90%, theo bảng trọng số dưới đây.
- Chưa thể kết luận hồ sơ bàn giao hoàn thành 100%. Tỷ lệ chức năng không đại diện cho việc đã có đầy đủ báo cáo, checklist, triển khai production hoặc thanh toán ngân hàng thật.

Không dùng số màn hình hoặc số dòng code để tính tỷ lệ. Một chức năng được tính khi có luồng UI/API/persistence liên quan; bằng chứng build/test được ghi riêng. Các kiểm tra mới thực hiện trong DB tách biệt, không thay dữ liệu thật của người dùng bằng dữ liệu mẫu.

## Review 1

| Nhóm luồng | Hiện trạng và bằng chứng |
| --- | --- |
| Đăng nhập và phân quyền bốn phòng ban | Có cookie session/CSRF, chặn truy cập sai quyền, tài khoản bị vô hiệu hóa; smoke kiểm tra |
| Admin danh mục và Retail hồ sơ khách | CRUD danh mục, đăng ký/sửa/tìm khách, profile Review 1 được lưu DB; smoke và kịch bản UI |
| Request → xác nhận Order → khảo sát → kích hoạt | Mã Order 11 ký tự, Account 16 ký tự, nhánh NotFeasible, lịch sử trạng thái, giữ điều kiện cọc trước kích hoạt |
| Billing cơ bản và thanh toán | Lập bill, tính cước/thuế, ghi thu Retail/Billing, Paid/PartiallyPaid; lịch sử nay giữ đủ qua các kỳ |
| Tra cứu, feedback, tải lại dữ liệu | Tra cứu Order/Account, feedback sau Connected, public tracking không lộ tên/địa chỉ; có kiểm tra qua API và bằng chứng UI |

Review 1 gần hoàn chỉnh về chức năng. Phần chưa chấm tuyệt đối là độ chặt chẽ của dữ liệu lịch sử/chứng từ và các giả định biểu phí, cùng hồ sơ review/bàn giao chưa đầy đủ theo mẫu đề. Không cần thay phần đã chạy bằng mock để trình bày.

## Review 2 — bảng trọng số

Trọng số do người rà soát đặt để ưu tiên các luồng nghiệp vụ của đề và mục tiêu README §6. Mỗi hàng ghi điểm đạt/tối đa; tổng **88/100**.

| Nhóm | Điểm | Đã có trong source | Phần còn thiếu hoặc giới hạn |
| --- | ---: | --- | --- |
| Phân quyền, nhân sự, hồ sơ khách | 10/10 | Bốn phòng ban, Customer riêng, gán điểm bán, vô hiệu hóa nhân viên/khách, quyền sở hữu | Đạt phạm vi ứng dụng hiện tại; không suy ra đã qua audit bảo mật production |
| Danh mục và biểu phí | 8/10 | 18 gói mẫu trong demo, chu kỳ/giờ/tốc độ/tariff, Admin CRUD, public plans từ API | STD Yearly đang có giá giả định 780 trong seed cũ; cần chốt với đề. Chưa có phiên bản tariff đầy đủ và mức vượt giờ Internet |
| Request/Order, mã và khả thi/kích hoạt | 12/12 | Luồng Retail xác nhận, ba loại dịch vụ, khảo sát, mã đúng cấu trúc, guard trạng thái/cọc | Đạt luồng cốt lõi của đề; thiếu mở rộng snapshot được trừ ở nhóm gói/vòng đời |
| Hóa đơn trả sau, thuế, usage, dư nợ | 12/15 | Nhiều bill, phút gọi, phí thiết bị, thuế 12,24%, chuyển nợ, lịch sử bill | Chưa khóa trùng/chồng kỳ, chưa due date/quá hạn/kỳ lẻ, quota/usage Internet mới là thông tin gói; tariff/chu kỳ còn đọc gói hiện tại |
| Thu tiền và lịch sử thanh toán | 11/12 | Thu từng phần/toàn phần, tất cả kỳ/kênh, bill gốc, người thu/điểm bán, tìm/lọc/phân trang, cảnh báo thiếu chứng từ | Direct payment chưa có operationId bền vững, method/reference còn ở note, chưa reversal và biên nhận xuất/in chuẩn |
| Bulk, cọc và advance | 11/12 | Bulk đúng cọc/advance quote, không giảm rental; ledger riêng, tiền thực nhận, thu/hoàn nhiều lần, phân bổ bill, chống trùng/tranh chấp, legacy đối soát cọc | Mức advance gốc, cách tính ngưỡng chồng và thuế cọc là chính sách nhóm cần xác nhận. Chưa nhập/đối soát advance lịch sử bằng chứng từ riêng |
| Vòng đời và đổi gói | 7/8 | Tạm ngừng, kích hoạt lại, chấm dứt, mở hoàn đúng điều kiện; đề xuất/duyệt đổi gói cùng loại | Chưa quản lý đầy đủ ngày hiệu lực/giá và lịch sử snapshot khi đổi gói giữa kỳ |
| Tra cứu nâng cao | 4/5 | Tìm đơn/kết nối theo ID, tên, loại, điện thoại, khoảng ngày/trạng thái | Nhiều query giới hạn 100 bản ghi; UI phân trang trên kết quả đã tải, chưa paging server đầy đủ |
| Thiết bị, kho, vendor, mua hàng | 6/8 | Vendor, PO nhận/hủy, nhập kho khi nhận, cấp thiết bị trừ kho, incident/phí thay, payment vendor | Cấp thiết bị còn tùy chọn; thiếu chọn thiết bị xuyên Request/Order, sổ biến động/thu hồi/thay thế có audit đầy đủ |
| Điểm bán và liên kết nhân viên | 3/3 | CRUD outlet, gán nhân viên, nguồn Order/payment và chứng từ | Đạt mức cơ bản của đề; trường outlet thiếu trên payment lịch sử được giữ thiếu, không tự gán |
| Customer portal, hồ sơ và hỏi đáp | 4/5 | Khách có đăng nhập, tự xem Request/Connection/bill/payment, phản hồi/query, upload/download hồ sơ theo năm/khu vực | Biên nhận chưa liên kết tệp chứng từ trực tiếp với mỗi payment/bill; nhiều danh sách vẫn giới hạn 100 |
| **Tổng** | **88/100** | | |

Thanh toán CustomerPortal hiện là ghi nhận payment vào DB, chưa tích hợp PSP/webhook/đối soát tiền thật. Đề gốc yêu cầu khách xem bill, không bắt buộc một PSP cụ thể; vì vậy không lấy thiếu PSP làm lý do duy nhất trừ điểm chức năng, nhưng cũng không mô tả luồng đó là đã xử lý tiền online thật.

## Bốn vấn đề đã xử lý trong chuỗi sửa này

| Vấn đề | Kết quả |
| --- | --- |
| Ưu đãi bulk sai phạm vi | Chỉ giảm cọc và báo giá advance được cấu hình, rental/usage/phí/thuế dịch vụ tính đủ; test 8 biên × 3 loại dịch vụ |
| Thu và hoàn cọc chưa chắc chắn | Snapshot theo Order, thu thực tế sau Feasible, đủ/miễn mới kích hoạt, hoàn số thực giữ, retry/concurrency/legacy rõ ràng |
| Chưa có advance riêng | Policy nullable trên gói, snapshot, thu thực, phân bổ payment và hoàn phần chưa dùng, không tạo credit từ miễn thu |
| Lịch sử thanh toán chưa đầy đủ | Đọc tất cả bill, giữ payment cũ qua rollover, thông tin bill/người thu/outlet, tổng theo phạm vi, cảnh báo legacy thiếu chứng từ, không phát sinh payment giả |

## Các việc nên làm tiếp, theo thứ tự

1. **Khóa tính đúng hóa đơn:** kỳ không trùng/chồng, snapshot tariff/chu kỳ, ngày hiệu lực đổi gói; xác nhận giá STD Yearly và các giả định thuế/advance. Đây là các điểm còn có thể ảnh hưởng số tiền.
2. **Hoàn thiện chứng từ payment:** operationId cho thu cước trực tiếp, method/reference riêng, receipt xuất/in và liên kết tệp chứng từ; reversal có lý do, không xóa lịch sử. Lịch sử nhiều kỳ đã được sửa, không cần dựng lại bằng mảng frontend.
3. **Thiết bị xuyên luồng:** chọn/ghi nhận thiết bị từ yêu cầu, xuất/thu hồi/thay thế và sổ biến động; chặn thiếu thiết bị theo chính sách từng dịch vụ.
4. **Bàn giao:** báo cáo tổng hợp, synopsis/requirement specification, thiết kế GUI/interface, task sheet, review report, checklist test/final và bằng chứng backup/restore. README/ERD/API/hướng dẫn test hiện có là nền, chưa thay toàn bộ bộ hồ sơ đề yêu cầu.
5. **Hoàn thiện triển khai:** paging server, giảm bundle frontend; xử lý các cảnh báo dependency NU1902/NU1903 có sẵn. Chưa dùng lượt sửa lịch sử để nâng dependency ngoài phạm vi.

## Bằng chứng kiểm tra sau sửa

- Backend build thành công; frontend TypeScript/Vite build và lint thành công, 37 ca công thức frontend đạt. Lint còn cảnh báo triple-slash trong theme có sẵn, Vite cảnh báo bundle lớn.
- Smoke HTTP đầy đủ đạt, bao gồm các luồng cũ, D01–D13 cọc, V01–V13 advance và H01–H08 lịch sử mới. Kiểm tra đăng nhập/quyền/CSRF và cô lập Customer vẫn đạt.
- EF/service với migration thật trên SQLite và SQL Server LocalDB: legacy cọc, A00–A18 advance, H01–H12 payment history đạt. Bao gồm mất lịch sử khi chuyển kỳ, concurrent payment rollback và legacy Paid thiếu payment không được tự lấp.
- UI đã kiểm tra Billing, Retail, Customer cùng xem năm payment thuộc ba kỳ, tổng lịch sử 125 USD, bill hiện tại Paid 0/Due 632,62; bộ lọc invoice/kênh/từ khóa và trạng thái rỗng hoạt động.
- Khởi động lại API trên cùng DB vẫn giữ năm payment/ID cũ. Nhánh 12 payment đã kiểm tra trang hai có đủ hai bản ghi còn lại; đổi rồi xóa bộ lọc/từ khóa đều trở về trang một. Sau bảy khoản thêm 1 USD, Paid kỳ hiện tại 7/Due 625,62; tổng lịch sử 132, không nhầm với Paid kỳ hiện tại.
- Không thay DB đang sử dụng; dữ liệu rehearsal/test được tạo trong database riêng qua API/domain/EF thật, không chặn request bằng mock hoặc dựng payment trong frontend. SQL Server production không seed các payment thử này.

Hướng dẫn chạy lại: [payment-history-flow.md](payment-history-flow.md), [deposit-flow.md](deposit-flow.md), [advance-flow.md](advance-flow.md). Tỷ lệ trên chỉ phản ánh code và bằng chứng đã xem tại ngày đánh giá; các bảng kế hoạch 18/11 trong README vẫn là lịch sử, không được xem là checklist hiện trạng.
