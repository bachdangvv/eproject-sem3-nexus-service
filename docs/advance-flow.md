# Advance: thu trước, phân bổ hóa đơn và hoàn phần chưa dùng

Advance là tiền khách thực nộp trước để Billing thanh toán hóa đơn về sau. Sổ này độc lập với cọc hoàn lại và với nghĩa vụ cước. Tài liệu ghi rõ cách hiểu của nhóm, luồng liên phòng ban và số tiền cần kiểm tra.

## Bám đề và giới hạn chính sách

Đề gốc đề cập ưu đãi bulk cho **advance và security deposit**, dịch vụ tính cước trả sau, nhưng không nêu mức advance gốc, thời điểm thu hoặc cách sử dụng. Vì vậy, các quy tắc dưới đây là **chính sách triển khai của nhóm**, không phải số liệu được quy định trong đề:

- Admin cấu hình `advancePerConnection` trên gói: để trống/null = chưa có chính sách, 0 = xác nhận không yêu cầu advance, số dương = mức trả trước tùy chọn cho mỗi đường truyền. Giới hạn 999.999,99 USD/đường, tối đa hai chữ số thập phân. Dữ liệu seed không tự gán một mức advance.
- Khi Retail xác nhận Request, Order chốt mức advance/đường, tổng gốc, mức bulk và báo giá sau bulk. Sửa gói hoặc đổi gói thuê bao về sau không sửa snapshot này. Các Order khác không cộng dồn số đường truyền để hưởng bulk.
- Dùng cùng khoảng bulk như cọc: 1–9: 0%; 10–14: 25%; 15–24: 50%; 25–50: 75%; từ 51: 100%. Đây là quy ước xử lý các khoảng chồng trong đề. Ưu đãi chỉ giảm **mức trả trước**, không giảm cước thuê bao và không tạo tiền tặng.
- Retail/Billing nhận một hoặc nhiều lần sau Feasible; cho phép thu tiếp sau Connected, kể cả tạm ngừng, trước khi hủy/chấm dứt. Tổng thực nhận không vượt báo giá đã chốt. Advance là tùy chọn, không thêm điều kiện kích hoạt; cọc vẫn là điều kiện bắt buộc hiện hành.
- Billing chủ động phân bổ số thực nhận chưa dùng vào một hóa đơn mở của chính Order/Account. Không tự cấn trừ khi thu advance hoặc khi phát hành bill. Mỗi lần phân bổ tạo một payment kênh `Advance`, liên kết cả hóa đơn và giao dịch sổ advance.
- Bill giữ nguyên rental, usage, phí thiết bị, thuế và tổng phải trả. Phân bổ chỉ tăng số đã thanh toán, giảm số còn nợ. Không tính thêm một lần thuế trên receipt advance, không đưa advance thành phụ phí hóa đơn.
- Billing hoàn phần chưa dùng sau Cancelled/NotFeasible/PermanentlyInactive. Phần đã phân bổ là thanh toán hóa đơn, không được hoàn bằng chức năng này. Tạm ngừng không mở quyền hoàn. Nếu còn nợ, Billing có thể phân bổ trước rồi hoàn phần dư; hệ thống không tự quyết định hoặc tự trừ nợ.

```text
Admin cấu hình chính sách gói
  → Retail xác nhận Order: chốt báo giá advance và cọc riêng
  → Technical xác nhận Feasible
  → Retail/Billing thu advance tùy chọn, ghi chứng từ thực nhận
  → Thu đủ/miễn cọc → Technical kích hoạt
  → Billing phát hành bill cước trả sau, vẫn tính đầy đủ
  → Billing phân bổ advance → tạo payment, giảm nợ bill
  → Hủy/chấm dứt → Billing hoàn số advance chưa dùng
  → Hoàn cọc là thao tác riêng trên sổ cọc
```

## Các số dư cần phân biệt

```text
Báo giá advance = mức/đường tại xác nhận × số đường × (1 − bulk%)
Số còn có thể thu = báo giá − tổng thực nhận (bằng 0 sau khi đóng)
Số dư advance chưa dùng = thực nhận − đã phân bổ − đã hoàn
Số được phân bổ = min(số dư chưa dùng, nợ còn lại của hóa đơn được chọn)
Số được hoàn = số dư chưa dùng, khi dịch vụ đã đóng
```

Báo giá và miễn thu không phải tiền thực nhận. Ví dụ 51 đường được miễn 100%: báo giá 0, thực nhận 0, số dư dùng trả bill 0; rental vẫn tính đủ. Advance không thay thế cọc. Thu cọc không tạo advance; thu tiền hóa đơn trực tiếp không tạo advance.

Mỗi giao dịch có `operationId`, mã chứng từ `reference`, lý do `note`, người thao tác, thời điểm UTC, phương thức, điểm bán nếu có và số dư sau giao dịch. Phân bổ còn có `invoiceId` và `paymentId`. Gửi lại cùng ID, cùng nội dung và cùng người thao tác trả sổ hiện tại, không thêm tiền; đổi nội dung trên ID cũ trả 409. Chứng từ trùng trong cùng Order/loại giao dịch cũng bị chặn.

DB ghi số dư, giao dịch và payment/bill trong một lần lưu nguyên tử. Version sổ advance, trạng thái Order/Connection và số tiền/trạng thái hóa đơn được kiểm tra đồng thời. Hai thao tác phân bổ/hoàn không thể cùng tiêu hết một số dư. Phân bổ cùng lúc với thanh toán trực tiếp hoặc chuyển kỳ phải phát hiện dữ liệu cũ, rollback và yêu cầu tải lại.

## Chuẩn bị test UI

Dùng database riêng theo phần [Chuẩn bị diễn tập UI của sổ cọc](deposit-flow.md#chuẩn-bị-diễn-tập-ui). Backend cổng 5168, frontend cổng 5173. Tài khoản mẫu `admin.demo`, `retail.demo`, `technical.demo`, `billing.demo`, mật khẩu `Nexus-Demo-2026!`.

Tạo khách thử riêng hoặc đăng ký tài khoản Customer mới để kiểm tra quyền sở hữu. Dùng gói **Advance Rehearsal Broadband**, loại B, giá chu kỳ tháng **225 USD**, optional advance **100 USD/đường**, Active. Mức 100 USD chỉ là **dữ liệu kiểm thử do nhóm chọn**, không phải mức của đề bài. Mỗi lần diễn tập nên dùng DB mới hoặc mã chứng từ mới.

Sao chép Order ID, Account ID và số hóa đơn thực tế. Trong ảnh chứng minh lần này, Order là `B0000000004`, Account là `B101000000000004`; các mã của lần chạy khác có thể khác.

## Luồng chính và kết quả kỳ vọng

| Bước | Vai trò/màn hình | Thao tác | Kết quả phải thấy |
| --- | --- | --- | --- |
| 1 | Admin → Plans | Create Plan với thông tin trên. Edit để kiểm tra mức advance; tắt/bật Active rồi mở Edit lại | Advance/Line = 100; tắt/bật không làm mất chính sách. Các gói mẫu khác vẫn Not configured |
| 2 | Retail → Requests | Tạo Request cho khách thử, chọn gói thử, 10 đường truyền | Dự toán: rental 2.250; thuế 275,40; cọc 3.750; optional advance quote 750. Tổng dự toán cước+cọc vẫn 6.275,40, không cộng advance thành phí thứ hai |
| 3 | Retail → Requests/Orders | Xác nhận Request, sao chép Order ID | Advance snapshot: gốc 1.000; bulk 25% = 250; báo giá 750; thực nhận và số dư đều 0 |
| 4 | Technical → Orders | Xác nhận Feasible | Mở quyền thu advance và cọc. Chưa thu cọc thì kích hoạt vẫn bị chặn |
| 5 | Retail → Billing & Payments → Advance Payments | Chọn Order advance; Record advance receipt: 750, Cash, reference `ADV-RCPT-001`, reason rõ ràng | Actually received = 750, Unused credit = 750; có một Collection. Chưa có bill thì chưa phân bổ được |
| 6 | Retail → Security Deposits | Thu riêng cọc 3.750 với chứng từ `DEP-RCPT-001` | Sổ cọc giữ 3.750. Sổ advance vẫn nhận 750, không đổi theo cọc |
| 7 | Technical → Orders | Kích hoạt Order | Account ID được cấp; không tạo thêm cọc hoặc advance |
| 8 | Billing → Account Lookup | Tìm Account, Generate Bill | Rental 2.250; thuế 275,40; Total/Due 2.525,40; Paid 0; không tự trừ advance 750 |
| 9 | Billing → Advance Payments | Chọn Order; Apply advance to invoice; chọn đúng bill; 500; reference `ADV-ALLOC-001` | Applied to invoices = 500, Unused credit = 250. Bill Paid = 500, Due = 2.025,40; Total/Tax giữ nguyên |
| 10 | Billing → Inspect Details | Xem payment history và invoice | Có đúng một payment 500, Channel Advance Credit, liên kết Invoice/Payment trong advance history. Registry và bill được làm mới sau phân bổ |
| 11 | Customer → Orders/Billing | Đăng nhập khách sở hữu Order | Chỉ xem sổ của mình, nhận 750/đã dùng 500/còn 250; bill trả một phần. Không có form ghi nhận thu/phân bổ/hoàn |
| 12 | Technical → Connections | Terminate vĩnh viễn Account, nhập lý do | Advance còn 250 trở thành refundable; cọc 3.750 cũng có thể hoàn qua luồng cọc riêng; nợ bill vẫn 2.025,40 |
| 13 | Billing → Advance Payments | Chọn Refund; 250, Cash, reference `ADV-REF-001`, reason | Received 750; Applied 500; Refunded 250; Unused 0; có ba giao dịch Collection/Allocation/Refund. Không thể hoàn lại 500 đã dùng |
| 14 | Billing → Security Deposits và bill | Kiểm tra/hoàn riêng cọc khi cần | Hoàn advance không thay đổi cọc. Nếu hoàn cọc 3.750 thì bill vẫn còn nợ 2.025,40; không ghi khoản hoàn advance vào payment giảm nợ |

Ảnh từ luồng UI đã chạy: [Sau phân bổ 500 USD](evidence/07-advance-allocation.png), [Sau hoàn 250 USD chưa dùng](evidence/08-advance-refund.png).

Để test thu nhiều lần, thay bước 5 bằng 300 rồi 450 với hai chứng từ; các số cuối giống nhau. Thu 451 sau 300 phải bị từ chối. Trước Feasible, sau Cancelled/Terminate hoặc với policy null, API thu trả 409.

## Nhánh chuyển kỳ, thu tiền trực tiếp và đổi gói

Chạy nhánh này trên Order khác hoặc trước bước Terminate; không vừa phân bổ hết số 250 vừa kỳ vọng hoàn 250.

1. Sau khi phân bổ 500 ở kỳ đầu, phát hành kỳ tiếp theo cùng giá, không usage/phí: dư nợ cũ 2.025,40 + phí kỳ mới 2.525,40 = Total **4.550,80**. Bill cũ chuyển RolledOver, Due = 0; payment cũ 500 vẫn giữ trong lịch sử.
2. Không phân bổ thêm vào bill RolledOver. Dùng 250 còn lại cho bill mới: Paid = 250, Due = **4.300,80**, số dư advance = 0. Khoản 500 đã dùng kỳ trước không trở thành credit mới và không được tính thêm lần nữa.
3. Nếu khách thanh toán tiền mặt/online trực tiếp, Due của bill giảm tương ứng, số dư advance không đổi. Tải lại danh sách advance để chọn bill với nợ mới; frontend Billing tự làm mới danh sách sau payment tại màn này.
4. Sửa advance của Plan từ 100 lên 200: Order đã xác nhận vẫn 750; Order 10 đường được xác nhận sau đó là 1.500. Plan change trên thuê bao không tạo khoản thu advance bổ sung hoặc sửa snapshot Order cũ.

## Các nhánh bắt buộc kiểm tra

| Nhánh | Kết quả |
| --- | --- |
| Policy null và policy 0 | Null là NotConfigured, 0 là NotRequired; không thu được, không tự gán giá, không chặn kích hoạt khi đã đủ/miễn cọc |
| 51 đường, policy 100 | Waived; gross 5.100, quote/received/available = 0; không có tiền miễn thu để trả bill |
| Thu 30 trên báo giá 100 rồi Retail hủy | Chỉ được hoàn tối đa 30; không hoàn 100 theo báo giá |
| Phân bổ lớn hơn credit hoặc lớn hơn Due | 409, không thêm payment và không đổi số dư |
| Hóa đơn tài khoản khác/không tồn tại | 404; bill Paid/RolledOver trả 409 |
| Thu advance sau kích hoạt | Được phép nếu còn báo giá chưa thu và dịch vụ chưa đóng; không thu bù quá quote |
| Tạm ngừng | Có thể thu/phân bổ theo điều kiện hiện hành; chưa được hoàn |
| Hai nhân viên cùng thu hết quote | Một thành công, một 409; tổng không vượt quote |
| Đồng thời phân bổ và hoàn cùng số dư sau đóng | Chỉ thao tác hợp lệ đầu tiên được commit; thao tác còn lại 409, không xuất hiện tiền âm |
| Advance allocation chạy đua payment tiền mặt/chuyển kỳ | Phát hiện thay đổi bill kể cả khi status vẫn PartiallyPaid; giao dịch lỗi rollback toàn bộ |
| Gửi lại cùng operationId | Không thêm receipt/payment/refund; khác nội dung, khác actor hoặc đổi ID nhưng trùng reference bị 409 |
| Retail/Technical/Customer gọi allocation hoặc refund | 403. Admin chỉ đọc/quản lý policy, không trực tiếp ghi tiền |
| Customer xem dữ liệu | Chỉ sổ của chính chủ; không truyền customerId để mở rộng quyền; các route ghi tiền nhân viên bị 403 |

## Database cũ và migration

Hai bộ migration `OrderAdvanceCredit` được bổ sung cho DemoDb và SqlServerDb. Startup tạo sổ `Origin = Legacy` cho Order cũ với snapshot policy null, tiền thực nhận/đã dùng/đã hoàn đều 0. Chạy startup nhiều lần không thêm sổ trùng.

Không suy luận advance từ tiền cọc, payment hóa đơn hoặc giá gói hiện tại. Không sửa số tiền/bill/payment cũ. Order đã xác nhận lúc policy chưa cấu hình cũng giữ nguyên null; việc Admin cấu hình sau không hồi tố. Nếu sau này có chứng từ advance lịch sử thật, cần nghiệp vụ nhập/đối soát riêng; hiện chưa có chức năng tự nhập các khoản đó.

## Lệnh kiểm tra tự động

Chạy tại gốc repository sau khi đã restore dependency:

```powershell
dotnet build backend/Nexus.slnx --no-restore
npm run build --prefix frontend
npm run lint --prefix frontend
npm test --prefix frontend
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/smoke.ps1
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore
# Cần SQL Server LocalDB đã cài:
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore -- --sqlserver
```

- Frontend có 37 ca công thức: gồm biên bulk, advance null/0/waiver và không cộng advance hai lần vào tổng dự toán.
- Smoke chạy toàn luồng cũ, D01–D13 cọc và V01–V13 advance qua API có phân quyền/CSRF; `backend/scripts/advance-scenarios.ps1` được gọi trong smoke, không chạy riêng.
- `Nexus.DepositChecks` chạy migration/legacy cọc và A00–A18 advance trực tiếp với EF/service: snapshot, payment liên kết, retry, cọc không đổi, rollover, số dư hoàn, tranh chấp số tiền bill và trạng thái vòng đời. Cùng bộ ca chạy trên SQLite và SQL Server LocalDB.

API và quyền chi tiết ở [docs/api.md](api.md), cấu trúc dữ liệu ở [docs/erd.md](erd.md). Các số 100/750/500/250 trong tài liệu là fixture kiểm thử; không được hiểu thành biểu phí advance mặc định của đề.
