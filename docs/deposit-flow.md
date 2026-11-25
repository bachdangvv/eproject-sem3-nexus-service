# Thu và hoàn tiền đặt cọc

Luồng hiện tại tách tiền cọc theo Order khỏi hóa đơn cước trả sau. Chỉ tiền đã có bằng chứng thu mới trở thành số dư được giữ và có thể hoàn. Tài liệu này dùng để diễn tập UI, kiểm tra API và đối soát dữ liệu cũ.

## Quy định của đề và chính sách của nhóm

Đề gốc quy định cọc Dial Up 325 USD, Broadband 500 USD, Landline 250 USD; áp ưu đãi bulk cho cọc và hoàn khi khách rút hoặc hủy dịch vụ. Retail và Billing quản lý tiền thu, Technical quản lý kết nối. Đề chưa quy định thời điểm thu cọc, phân bổ khoản thanh toán một phần hoặc việc cấn trừ cọc với công nợ.

Chính sách triển khai của nhóm:

- Chốt cọc gốc, tỷ lệ bulk và cọc phải thu tại lúc Retail xác nhận Request thành Order. Giá trị này là nghĩa vụ dự kiến, chưa phải tiền đã thu.
- Thu sau khi Technical xác nhận Feasible, trước khi kích hoạt. Cho phép nhiều lần thu, nhưng tổng thu mới không vượt cọc phải thu. Kích hoạt khi đã thu đủ hoặc cọc được miễn 100%.
- Cọc liên kết Order trước khi có Account ID. Kích hoạt giữ nguyên quan hệ này, không tạo khoản cọc thứ hai.
- Cọc nằm ngoài hóa đơn cước mới. Hóa đơn tính đầy đủ rental, usage, phí thiết bị và thuế dịch vụ theo chính sách hiện tại. `includeDeposit: true` trả 400 để chặn cộng cọc lần nữa.
- Billing hoàn sau khi Order Cancelled/NotFeasible hoặc kết nối PermanentlyInactive. Tạm ngừng không mở quyền hoàn cọc.
- Hoàn tối đa số dư thực giữ; không tự trừ nợ cước hoặc phí hỏng thiết bị. Các khoản đó tiếp tục nằm trong nghiệp vụ billing riêng.
- Advance có [sổ và luồng riêng](advance-flow.md), chỉ tiền thực nhận mới dùng thanh toán hóa đơn; không thay thế cọc. Thuế trên cọc vẫn là điểm cần xác nhận; luồng hiện tại không tính thuế cọc.

```text
Retail xác nhận Order
  → Technical đánh giá khả thi
  → Retail hoặc Billing ghi nhận một hay nhiều lần thu cọc
  → Technical kích hoạt khi đủ cọc hoặc được miễn
  → Billing lập hóa đơn cước trả sau, không cộng cọc
  → Retail hủy đơn chưa kích hoạt hoặc Technical chấm dứt kết nối
  → Billing ghi nhận một hay nhiều lần hoàn theo số dư thực giữ
```

## Dữ liệu và bằng chứng

`SecurityDeposits` có một bản ghi cho mỗi Order. `GrossAmount`, `DiscountPercent`, `RequiredAmount` là snapshot nghĩa vụ. `CollectedAmount` và `RefundedAmount` là tổng đã được xác nhận. Các giao dịch nằm trong `DepositTransactions`, lưu người thao tác, thời điểm UTC, phương thức, mã biên nhận, lý do, điểm bán nếu nhân viên được gán điểm bán, và tổng đã thu/hoàn sau mỗi bản ghi.

```text
Cọc phải thu = cọc gốc − ưu đãi bulk
Số dư thực giữ = cọc thực thu đã xác nhận − cọc đã hoàn
Số được hoàn = số dư thực giữ, khi dịch vụ đã đóng và không còn cần đối soát
```

Thu và hoàn mới phải có số tiền dương với tối đa hai chữ số thập phân, `method`, `reference`, `note` và `operationId`. Dùng cùng `operationId` và cùng nội dung khi gửi lại một thao tác chưa rõ kết quả. Cùng ID nhưng khác nội dung trả 409. Một mã biên nhận của cùng loại giao dịch trên cùng Order cũng không được ghi hai lần.

Backend kiểm tra phiên bản sổ cọc và trạng thái Order/Connection trong cùng lần ghi DB. Hai nhân viên cùng thu hoặc hoàn vượt số còn lại không thể cùng thành công. Hủy đơn, kích hoạt và chấm dứt cũng làm thay đổi phiên bản sổ cọc.

## Chuẩn bị diễn tập UI

Chạy từ thư mục gốc repository. Dùng database rehearsal riêng để các số tiền và mã chứng từ của lần diễn tập không lẫn với dữ liệu đang sử dụng.

```powershell
# Terminal backend
$rehearsalDir = Join-Path (Get-Location) ('backend/data/deposit-rehearsal-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $rehearsalDir | Out-Null
$env:ConnectionStrings__Demo = "Data Source=$rehearsalDir/demo.db;Foreign Keys=True"
$env:Logging__EventLog__LogLevel__Default = 'None'
dotnet run --project backend/Nexus.Api -- --demo --urls http://127.0.0.1:5168

# Terminal frontend
npm run dev --prefix frontend
```

Mật khẩu demo: `Nexus-Demo-2026!`. Dùng `retail.demo`, `technical.demo`, `billing.demo`, `customer.demo`. Tạo khách thử tên `Kiem thu tien coc`, điện thoại `0900000099`, địa chỉ `10 Test Street`, City `101`. Chọn BB Basic giá 225 USD, một đường truyền.

Sao chép Order ID và Account ID thực tế được cấp. Database demo đã có ba Order mẫu; Order mới đầu tiên thường là `B0000000004`. Trong các bước dưới, dùng mã vừa tạo thay cho mã ví dụ.

## Luồng demo chính

| Bước | Vai trò và màn hình | Thao tác | Kết quả cần thấy |
| --- | --- | --- | --- |
| 1 | Retail, Customers rồi Requests | Tạo khách, tạo request BB Basic một đường, xác nhận thành Order | Pending. Cọc phải thu 500, thực thu 0, số dư 0. Chưa có Account ID. |
| 2 | Technical, Assessments | Lưu Distance within limit và Server available | Order Feasible. Tại Connections, nút Activate bị khóa khi chưa thu đủ cọc. |
| 3 | Retail, Billing & Payments, thẻ Security Deposits | Find theo Order ID, chọn đúng Order deposit. Record deposit receipt: Amount 200, Method Cash, Reference `DEMO-COLLECT-001`, lý do `Thu coc dot 1` | Partially collected. Thực thu 200, số dư 200, còn phải thu 300. Một giao dịch Collection có người thu/thời điểm. |
| 4 | Technical, Connections | Refresh và xem đúng Order | Vẫn bị chặn kích hoạt vì thiếu 300. Gọi API trực tiếp cũng trả 409. |
| 5 | Retail hoặc Billing, Security Deposits | Thu tiếp 300, Reference `DEMO-COLLECT-002`, lý do `Thu du coc` | Collected. Tổng thu/số dư 500, còn phải thu 0. Có hai giao dịch Collection. |
| 6 | Technical, Connections | Refresh, Activate, chọn thiết bị có đủ tồn hoặc None nếu khách tự có thiết bị | Connected, có Account ID. Sổ cọc vẫn gắn với Order cũ và có cùng số dư 500. |
| 7 | Billing, Account Lookup | Tìm Account ID, lập hóa đơn không usage/phí | Rental 225, thuế 27,54, tổng 252,54. Deposit trong hóa đơn bằng 0. Cọc thực giữ ở Security Deposits vẫn là 500. |
| 8 | Retail hoặc Billing, thanh toán hóa đơn | Ghi nhận trả 100 | Hóa đơn PartiallyPaid, còn nợ 152,54. Cọc thực giữ vẫn 500. |
| 9 | Technical, Lifecycle | Tạm ngừng rồi khôi phục | Khi tạm ngừng, cọc không được hoàn. Sau khôi phục, dịch vụ Active; sổ cọc không đổi. |
| 10 | Technical, Lifecycle | Terminate với lý do khách rút dịch vụ | PermanentlyInactive. Refund pending 500. Nợ cước 152,54 không bị tự trừ khỏi cọc. |
| 11 | Billing, Security Deposits | Find và chọn Order. Record deposit refund 200, Reference `DEMO-REFUND-001`, lý do `Hoan coc dot 1` | Đã hoàn 200, còn giữ/có thể hoàn 300. Chưa ghi thành hoàn hết. |
| 12 | Billing, Security Deposits | Hoàn tiếp 300, Reference `DEMO-REFUND-002`, lý do `Hoan het coc` | Refunded. Tổng thu 500, tổng hoàn 500, số dư 0. Lịch sử có đủ hai lần thu, hai lần hoàn. |
| 13 | Billing, hóa đơn và refresh | Tìm lại Account ID sau tải lại trang | Hóa đơn vẫn còn nợ 152,54. Trả/hoàn cọc không tự xóa, thanh toán hoặc điều chỉnh công nợ cước. |

## Nhánh hủy khi mới thu một phần

Tạo một Order Broadband khác, đánh giá Feasible và thu cọc 200. Tại Retail → Billing & Payments → Security Deposits, chọn action **Cancel this order**, nhập lý do khách hủy trước lắp đặt. Order chuyển Cancelled, không thể khảo sát hoặc kích hoạt lại.

Billing chọn cùng Order và hoàn 200. Kết quả: cọc phải thu lịch sử vẫn 500, thực thu 200, thực hoàn 200, số dư 0. Phần 300 chưa từng thu không trở thành tiền được hoàn và không còn là khoản phải thu của đơn đã hủy.

Nhánh này đã được diễn tập bằng trình duyệt: Retail thu 200, hủy Order, Billing hoàn 200, tải lại vẫn thấy hai giao dịch và số dư 0.

![Kết quả thu và hoàn cọc trên giao diện](evidence/06-deposit-refund.png)

## Nhánh miễn cọc theo bulk

Với 10 đường BB Basic, sổ cọc hiển thị gốc 5.000, giảm 25% là 1.250, phải thu 3.750 USD. Sau khi thu đủ, kích hoạt rồi lập bill: rental 2.250, thuế 275,40, hóa đơn cước 2.525,40 USD. Tổng dự toán hai khoản là 6.275,40 USD nhưng được ghi thành khoản cọc và hóa đơn riêng.

Với 51 đường BB Basic, sổ cọc là Waived, phải thu 0 và không tạo Collection giả. Có thể kích hoạt sau Feasible. Hóa đơn cước vẫn 12.879,54 USD; chấm dứt không tạo khoản hoàn cọc.

## Đối soát dữ liệu cũ

Migration chỉ thêm hai bảng sổ cọc/giao dịch. Khi API khởi động, backfill tạo hồ sơ cho Order cũ chưa có sổ; chạy lại không tạo thêm hồ sơ hay giao dịch trùng. Hóa đơn cũ giữ nguyên rental, deposit, discount, tax, total, paid, due, trạng thái và các khoản thanh toán.

| Dữ liệu cũ | Xử lý |
| --- | --- |
| Đúng một hóa đơn chứa cọc, Paid, có thời điểm trả và tổng giao dịch thanh toán khớp toàn bộ bill | Ghi một phân bổ cọc từ hóa đơn cũ, có `sourceInvoiceId`. Đây là nhập bằng chứng cũ, không thu thêm tiền. |
| Có đủ hồ sơ hoàn cũ và cọc đã được chứng minh | Nhập lịch sử hoàn, giữ số dư đúng, không mở quyền hoàn lại phần đã chi. |
| Hóa đơn trả một phần, RolledOver, nhiều hóa đơn cùng chứa cọc, thiếu chứng từ hoặc không có bill | NeedsReconciliation. Không suy ra tiền cọc từ mức giá hay tổng tiền đã trả. Chặn thu mới, kích hoạt và hoàn cho tới khi Billing đối soát. |
| Trạng thái chờ hoàn cũ có số tiền lý thuyết nhưng không có bằng chứng thu | Vẫn NeedsReconciliation; số được hoàn qua API bằng 0. |

Billing vào Security Deposits, chọn **Reconcile legacy evidence**, nhập tổng cọc thực thu, tổng đã hoàn, mã chứng từ và lý do. Ví dụ bill cũ đã trả 300 nhưng chứng từ xác định chỉ 200 là cọc: nhập collected 200, refunded 0. Giao dịch Reconciliation ghi lại hai tổng đã xác minh; không nhận hoặc gửi tiền lần nữa.

Không được giảm các tổng đã xác minh hoặc ghi đã hoàn nhiều hơn thực thu. Nếu chứng từ cũ chứng minh đã thu cọc thừa, đối soát được ghi đúng số tiền thực tế, kể cả vượt nghĩa vụ gốc; tiền thừa vẫn là tiền khách cần hoàn. Quy tắc thu cọc **mới** vẫn chặn thu vượt mức phải thu. Phải xem chứng từ độc lập, không tự cộng các hóa đơn trùng để tuyên bố đã nhận tiền.

Các chứng từ bị thiếu không thể khôi phục bằng cách lấy giá danh mục hiện tại. Những dữ liệu từng bị mất bởi migration cũ cũng cần đối soát ngoài hệ thống.

## Chạy kiểm thử tự động

Từ thư mục gốc repository:

```powershell
dotnet build backend/Nexus.slnx
npm test --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend

# Smoke API tạo SQLite riêng, gồm toàn bộ luồng cơ bản và các nhóm D01 đến D13
$env:Logging__EventLog__LogLevel__Default = 'None'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/smoke.ps1

# Tạo database ở migration trước sổ cọc, chạy nâng cấp và kiểm tra bằng EF thật
dotnet run --project backend/Nexus.DepositChecks

# Cùng bộ kiểm tra trên SQL Server LocalDB, cần SQL Server LocalDB được cài
dotnet run --project backend/Nexus.DepositChecks -- --sqlserver
```

Smoke dùng database GUID riêng; thành công sẽ dọn thư mục smoke sau khi kiểm tra đường dẫn. DepositChecks để lại database SQLite trong `backend/data/deposit-check-*` hoặc LocalDB có tên `NexusDepositCheck_*` phục vụ kiểm tra. Không dùng database production. Biến tắt EventLog chỉ xử lý quyền ghi Windows Event Log trong môi trường kiểm thử.

| Nhóm | Nội dung và kết quả pass |
| --- | --- |
| D01–D02 | Quote không tạo tiền thực thu; hủy đơn chưa thu không tạo tiền hoàn; đơn hủy bị chặn khảo sát/kích hoạt. |
| D03–D05 | Thu/hoàn một phần; retry không trùng; chặn đổi payload trên cùng ID, trùng biên nhận, thu vượt, hoàn vượt; chỉ Billing được hoàn. |
| D06–D09 | Thu đủ mới kích hoạt; cấm cộng cọc vào bill; tạm ngừng không hoàn; nợ/phí hỏng không tự cấn trừ; miễn cọc không tạo receipt/refund giả. |
| D10–D12 | Hai yêu cầu cùng lúc không thu/hoàn vượt; hai lần gửi cùng giao dịch chỉ tạo một bản ghi. |
| D13 | Customer chỉ xem sổ của mình và không xác nhận giao dịch nhân viên. |
| L01–L09 | Nâng cấp dữ liệu cũ, chứng từ trả đủ, trả một phần, RolledOver, nhiều bill chứa cọc, hoàn cũ, đối soát và bảo toàn hóa đơn. |
| L10–L11 | Trạng thái Order cũ cộng phiên bản sổ mới sau hủy vẫn bị chặn ghi tiền; rollback không để lại khoản thu. |
| L12–L13 | Thu cọc thừa trong lịch sử chỉ được ghi khi có bằng chứng, có thể hoàn toàn bộ số thực giữ; không nới giới hạn thu mới. |
| Bulk | 9/10/14/15/24/25/50/51 đường cho cả B/D/T; đúng mức cọc, cước và thuế không bị giảm. |

Khi bàn giao, lưu commit, môi trường, database rehearsal, người chạy và kết quả thực tế. Không đánh dấu đạt một ca chỉ vì UI có nút tương ứng.
