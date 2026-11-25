# Lịch sử thanh toán qua nhiều kỳ

## Vấn đề và cách sửa

DB đã lưu payment theo từng Invoice, nhưng `BillingService.ToView` trước đây chỉ đọc `invoice.Payments` của bill mới nhất. Sau khi phát hành kỳ mới, payment của bill cũ vẫn trong DB nhưng không xuất hiện trên Retail, Billing và Customer. Đây là lỗi phạm vi đọc dữ liệu, không phải lý do để tạo thêm payment bù.

Hiện tại API trả payment của **tất cả hóa đơn thuộc cùng Account**, kể cả Paid và RolledOver. Mỗi bản ghi giữ nguyên ID, số tiền, thời điểm, kênh, ghi chú và hóa đơn gốc. Thứ tự: thời điểm UTC giảm dần, sau đó ID giảm dần để ổn định khi trùng thời điểm. Payment mới giữ độ chính xác thời gian gốc, không cắt xuống giây.

Thông tin được bổ sung từ DB:

- `invoiceId`, `invoiceNumber`, `invoiceStatus`: nhận diện bill gốc và việc bill đã kết chuyển.
- `paidByUsername` là username thực; `paidByDisplayName` là tên hiển thị riêng.
- `retailShopId`, `retailShopName`: điểm bán đã ghi trên payment. Khi thu tiền mới, lưu điểm bán của người thu tại thời điểm ghi nhận. Không lấy điểm bán hiện tại của nhân viên để điền ngược lịch sử cũ.
- `receiptCode = PAY-{payment.Id:D10}`: mã tra cứu nội bộ từ ID thực đã lưu. Đây không phải bằng chứng đã đối soát ngân hàng hoặc cổng thanh toán.
- `paymentHistoryGaps`: các bill có `PaidAmount` khác tổng payment đã lưu. UI cảnh báo cần đối soát và nêu hai số; không tạo một payment giả để làm khớp.

Không bổ sung seed thanh toán, mảng mẫu, mock API hoặc fallback giả trong frontend. Dữ liệu kiểm thử được tạo ở DB riêng; UI/API sử dụng chính pipeline và giao dịch lưu DB của ứng dụng. Payment thiếu tên điểm bán hoặc ghi chú cũ được hiển thị là chưa ghi nhận. Chưa có nghiệp vụ nhập/đảo payment lịch sử; cần xác minh chứng từ trước khi bổ sung sau này.

## Các tổng không được trộn

| Chỉ số | Phạm vi |
| --- | --- |
| `BillingView.paidAmount` / `dueAmount` | Chỉ bill hiện tại, tiếp tục dùng cho thu tiền và công nợ |
| Service payments to date | Tổng các payment thực lưu trên toàn bộ bill của Account |
| Direct payments to date | Payment CityOffice/RetailOutlet/CustomerPortal đã ghi nhận |
| Advance applied to date | Payment Advance đã phân bổ vào bill, mỗi allocation chỉ một payment |
| Tổng theo bộ lọc | Chỉ các giao dịch khớp hóa đơn/kênh/từ khóa đang chọn |
| Tiền cọc, receipt advance, các khoản hoàn | Sổ Deposit/Advance riêng; không cộng lần nữa thành payment cước |

Không cộng tổng các hóa đơn để suy ra tổng tiền đã thu: bill mới có thể chứa nợ chuyển từ bill cũ. Không lấy `Invoice.PaidAt` làm ngày thu cuối duy nhất vì trường này đánh dấu trả đủ bill; nhãn Last Payment lấy thời điểm các payment thực, gồm trả một phần.

## Diễn tập UI với DB riêng

Chuẩn bị backend/frontend theo [deposit-flow.md](deposit-flow.md#chuẩn-bị-diễn-tập-ui). Gói thử Broadband tháng 225 USD, advance 100 USD/đường, một đường truyền. Mức advance 100 chỉ là chính sách thử, không phải mức đề bài. Tạo khách có tài khoản Customer riêng để kiểm tra quyền sở hữu. Tài khoản nhân viên dùng `admin.demo`, `retail.demo`, `technical.demo`, `billing.demo`, mật khẩu demo `Nexus-Demo-2026!`.

Luôn sao chép Order ID/Account ID/Invoice Number được cấp, không nhập cố định ID trong tài liệu vào một DB đã có dữ liệu khác.

| Bước | Thao tác | Kết quả kỳ vọng (USD) |
| --- | --- | --- |
| 1 | Admin cấu hình gói thử; Retail tạo Request và xác nhận; Technical xác nhận Feasible | Order có cọc 500 và advance quote 100; chưa có tiền thực nhận |
| 2 | Retail thu cọc 500 và advance 80 bằng hai chứng từ riêng | Cọc giữ 500, advance còn 80, lịch sử payment cước chưa có |
| 3 | Technical kích hoạt, Billing phát hành bill đầu | Rental 225, thuế 27,54; Total/Due 252,54, Paid 0 |
| 4 | Billing phân bổ advance 30 vào bill | Một payment Advance 30; bill còn nợ 222,54; advance chưa dùng 50 |
| 5 | Retail thu 40, ghi chú `H-RETAIL-001`; Billing thu 20, `H-OFFICE-001` | Ba payment, bill Paid 90, Due 162,54; receipt Retail có điểm bán thật đã gán |
| 6 | Customer sở hữu Account ghi nhận trả 10 qua luồng portal, `H-PORTAL-001` | Bốn payment/kênh khác nhau; Paid 100, Due 152,54. Đây là ghi nhận vào DB hiện hành, chưa tích hợp xử lý tiền ngân hàng thật |
| 7 | Billing → Next Period Bill, không usage/phí, chọn kỳ mới | Bill đầu RolledOver; bill mới Total/Due 405,08, Paid 0. Payment History vẫn bốn bản ghi, tổng 100, ID và bill gốc không đổi |
| 8 | Billing thu 25 ở kỳ hai, `H-OFFICE-002` | Năm payment toàn lịch sử, tổng 125. Riêng kỳ hai Paid 25, Due 380,08 |
| 9 | Billing phát hành kỳ ba cùng giá | Bill mới Total/Due 632,62, Paid 0. Lịch sử vẫn năm payment: direct 95, advance applied 30, tổng 125 |
| 10 | Billing → Inspect Details; Retail → View & Collect; Customer → View Invoices | Cùng Payment History của toàn bộ kỳ; thấy invoice gốc, trạng thái, UTC, người ghi nhận, điểm bán và ghi chú |
| 11 | Lọc Invoice payments chọn bill đầu; lọc Payment channel chọn Retail Outlet | Bill đầu có bốn payment/tổng 100; kết hợp Retail chỉ một payment 40 |
| 12 | Tìm `H-RETAIL-001`, rồi thử một mã không tồn tại | Tìm đúng bản ghi đã lưu; từ khóa không có dữ liệu hiển thị No matching payments, không thêm bản ghi mẫu |
| 13 | Clear filters, tải lại trang hoặc khởi động lại API trên cùng DB, đăng nhập lại | Vẫn năm payment với ID cũ, công nợ 632,62; đọc lịch sử không ghi thêm payment |
| 14 | Thử thu 633 khi đang nợ 632,62 | 409. Không âm thầm thu ít hơn số đã nhập; không thêm payment |
| 15 | Technical chấm dứt; Billing hoàn advance còn 50 và cọc 500 bằng luồng riêng | Payment cước vẫn năm bản ghi/tổng 125; nợ vẫn 632,62. Hai khoản hoàn không thành payment cước |
| 16 | Đăng nhập một Customer khác | Không thấy Account/lịch sử này; route nhân viên trả 403; truy cập thanh toán thuê bao khác trả 404 |

Ảnh các bước có năm bản ghi: [Billing](evidence/09-payment-history-billing.png), [Retail](evidence/10-payment-history-retail.png), [Customer](evidence/11-payment-history-customer.png).

Nhánh phân trang chạy trước bước chấm dứt hoặc trên Account khác: ghi nhận thêm bảy khoản 1 USD trên kỳ ba với bảy ghi chú/chứng từ khác nhau. Tổng số payment thành 12, lịch sử tổng 132; riêng kỳ ba Paid 7, Due 625,62. Page size 10 phải xem được trang hai chứa hai bản ghi còn lại. Chọn lại bill đầu hoặc lọc kênh phải đưa về trang một, kể cả khi xóa bộ lọc quay lại All billing periods; không làm mất payment khỏi DB. Đã chạy UI nhánh này: [ảnh trang hai](evidence/12-payment-history-pagination.png).

## API và kiểm thử

Không đổi route hoặc schema DB cho bản sửa này. Các route Billing/Retail list/detail, customer billing và response sau payment/create invoice đều dùng cùng phép chiếu lịch sử toàn Account. `payments` có nghĩa toàn bộ kỳ; client muốn số của một bill phải lọc theo `invoiceId`, không lấy tổng mảng làm `paidAmount` kỳ hiện tại.

```powershell
dotnet build backend/Nexus.slnx --no-restore
npm run build --prefix frontend
npm run lint --prefix frontend
npm test --prefix frontend
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/smoke.ps1
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore
# Cần SQL Server LocalDB:
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore -- --sqlserver
```

`payment-history-scenarios.ps1` được smoke gọi sau cọc/advance: H01–H08 kiểm tra HTTP thật qua bốn kênh, ba kỳ, ba vai trò đọc, điểm bán, thu vượt nợ, quyền sở hữu và hoàn riêng. Bộ EF/service trong `Nexus.DepositChecks` có H01–H12 trên SQLite và SQL Server: giữ ID, đối chiếu DB, tổng tiền đúng, xung đột với người vừa trả đủ và phát hiện legacy Paid thiếu payment mà không tự tạo giao dịch. Các ca này chạy cùng bộ legacy/cọc/advance để phát hiện ảnh hưởng chéo.

Thu tiền trực tiếp chưa có operationId bền vững như sổ cọc/advance. Khi mất phản hồi hoặc nhận 409 do tranh chấp, tải lại lịch sử và đối chiếu trước khi ghi tiếp. Chưa có phương thức/reference tách thành cột riêng trên PaymentTransaction; ghi chú lưu thông tin nhân viên nhập. Các điểm này được ghi vào [đánh giá hoàn thiện](completion-review.md), không coi lịch sử đầy đủ là đã có đối soát ngân hàng hoặc đủ mọi nghiệp vụ kế toán.
