# Luồng test tích hợp: bulk, cọc, advance và lịch sử thanh toán

Tài liệu này kiểm tra **bốn phần đã sửa**: ưu đãi bulk đúng phạm vi, thu/hoàn cọc, advance riêng và lịch sử payment nhiều kỳ. Bốn blocker audit B01–B04 cũng đã được sửa ngày 27/11; phần E cập nhật các ca hồi quy. Quy tắc gửi lại payment được mô tả trong [API](api.md).

## Chuẩn bị

- Mở [local login](http://127.0.0.1:5173/login). Backend đang dùng cổng 5168, frontend 5173.
- Nhân viên: `admin.demo`, `retail.demo`, `technical.demo`, `billing.demo`. Mật khẩu chung: `Nexus-Demo-2026!`.
- Đăng ký một tài khoản Customer thử mới qua Register, ghi Customer Code và mật khẩu vừa chọn. Retail phải tạo Request cho **đúng Customer này** để kiểm tra quyền sở hữu và payment portal.
- Admin → Plans tạo gói riêng: tên `QA Four Flows <mã lần chạy>`, Broadband/B, Monthly, giá **225 USD**, optional advance **100 USD/đường**, Active. Mức 100 chỉ là cấu hình kiểm thử do người chạy nhập, không phải mức của đề hoặc seed mặc định.
- Mỗi lần chạy dùng tên/chứng từ mới, ví dụ `QA01-DEP-01`, `QA01-ADV-01`. Nhập lý do cho giao dịch sổ cọc/advance. Tạo dữ liệu qua UI/API thật; không sửa mảng frontend hoặc chèn payment giả.
- Ghi Order ID, Account ID và Invoice Number **thực tế** hệ thống cấp. Không dùng lại đơn đã hủy/chấm dứt cho một nhánh cần kích hoạt.
- Để khớp số dưới đây, usage/phí thiết bị bằng 0. Nếu chọn thiết bị lúc kích hoạt, sản phẩm phải đủ tồn cho số đường; việc cấp phát chi tiết không nằm trong bốn phần đang test.

## A. Luồng chính với 10 đường truyền

Luồng này chạy liên tục trên **một Order**, qua hai kỳ bill, sau đó chấm dứt và hoàn số dư. Mọi số tiền trong bảng là USD.

| Bước | Tài khoản và thao tác | Kết quả bắt buộc |
| --- | --- | --- |
| A01 | Retail → Requests: chọn khách thử, gói QA, nhập **10** đường; xem dự toán, lưu rồi Confirm Request | Có Order Pending. Rental **2.250**, thuế dịch vụ **275,40**. Cọc gốc **5.000**, giảm 25% = **1.250**, phải thu **3.750**. Advance gốc **1.000**, giảm 25% = **250**, quote **750**. Thực nhận cọc/advance đều **0**. Tổng dự toán cước+cọc **6.275,40**, advance không cộng thành một phụ phí thứ hai |
| A02 | Technical → Assessments: đánh giá Feasible, rồi xem Connections | Chưa đủ cọc thì chưa kích hoạt được. Có quote advance chưa đồng nghĩa đã thu tiền |
| A03 | Retail → Billing & Payments → Security Deposits: tìm/chọn Order, thu **1.000**, Cash, reference `QA01-DEP-01` | Cọc thực thu/giữ **1.000**, còn phải thu **2.750**. Technical Refresh vẫn chưa kích hoạt được |
| A04 | Retail hoặc Billing: thu tiếp cọc **2.750**, reference `QA01-DEP-02` | Cọc thực thu/giữ **3.750**, còn phải thu **0**, hai Collection |
| A05 | Retail → Advance Payments: chọn Order, thu **300** rồi **450**, reference `QA01-ADV-01` và `QA01-ADV-02` | Actually received = Unused credit = **750**. Có hai Collection advance. Cọc vẫn **3.750**; chưa có payment cước nào |
| A06 | Technical → Connections: Refresh, Activate, sao chép Account ID | Connected/Active. Cọc và advance vẫn gắn Order cũ, không thu thêm hoặc tạo ledger thứ hai |
| A07 | Billing → Account Lookup: tìm Account, lập bill một lần cho **01/12/2026–01/01/2027**, usage/phí = 0 | Bill 1: rental **2.250**, thuế **275,40**, Total/Due **2.525,40**, Paid **0**, deposit trong bill **0**. Advance vẫn **750**, chưa tự thanh toán bill |
| A08 | Billing → Advance Payments: Apply advance to invoice, chọn bill 1, **500**, reference `QA01-ALLOC-01` | Bill 1 Paid **500**, Due **2.025,40**. Advance Allocated **500**, Unused **250**. Payment History có đúng một khoản **Advance Credit 500**. Total và thuế bill không đổi |
| A09 | Retail → Billing & Payments → View & Collect: thu cước **100**, note `QA01-RETAIL-01` | Bill 1 Paid **600**, Due **1.925,40**. Payment History có hai khoản: Advance 500 và Retail 100; thấy người thu/điểm bán đã lưu. Cọc vẫn **3.750**, advance còn **250** |
| A10 | Billing → Inspect Details → Next Period Bill: chọn **01/01/2027–01/02/2027**, usage/phí = 0, chỉ phát hành một lần | Bill 1 → RolledOver, Paid vẫn **600**, Due **0**. Bill 2: Previous Due **1.925,40** + phí kỳ mới **2.525,40** = Total/Due **4.450,80**, Paid **0**. Lịch sử vẫn giữ hai payment cũ với ID và bill gốc |
| A11 | Billing ghi nhận thu trực tiếp **200**, note `QA01-OFFICE-01` | Riêng bill 2 Paid **200**, Due **4.250,80**. Toàn lịch sử có ba payment, tổng **800** |
| A12 | Billing phân bổ tiếp advance **100** vào bill 2, reference `QA01-ALLOC-02` | Riêng bill 2 Paid **300**, Due **4.150,80**. Advance tổng Allocated **600**, Unused **150**. Toàn lịch sử có bốn payment, tổng **900** |
| A13 | Customer thử → Billing: chọn đúng Account, Pay Online **50**, note `QA01-PORTAL-01` | Bill 2 Paid **350**, Due **4.100,80**. Toàn lịch sử có **5 payment**, đủ bốn kênh. Đây là ghi nhận payment vào DB, chưa phải xử lý tiền qua ngân hàng/PSP thật |
| A14 | Billing → Inspect Details; Retail → View & Collect; Customer → View Invoices: kiểm tra Payment History và tải lại trang | Cùng năm payment ở hai bill; tổng lịch sử **950**, Direct payments **350**, Advance applied **600**. Riêng bill 2 Paid chỉ **350**, Due **4.100,80**. ID/payment bill cũ không mất hoặc đổi sau refresh |
| A15 | Lọc Invoice payments chọn bill 1; sau đó chọn bill 2; thử lọc Retail Outlet và tìm `QA01-RETAIL-01` | Bill 1 có hai payment/tổng **600**; bill 2 có ba payment/tổng **350**. Retail Outlet/từ khóa tương ứng chỉ có khoản **100**. Từ khóa không tồn tại cho kết quả rỗng, không có bản ghi mẫu |
| A16 | Technical → Lifecycle: tạm ngừng rồi khôi phục | Tạm ngừng không mở quyền hoàn cọc/advance. Khôi phục về Active, các số dư không đổi |
| A17 | Technical → Lifecycle: Terminate, nhập lý do | PermanentlyInactive. Cọc có thể hoàn **3.750**; advance chưa dùng có thể hoàn **150**. Nợ bill 2 vẫn **4.100,80** |
| A18 | Billing → Advance Payments: Refund **150**, Cash, reference `QA01-ADV-REF-01` | Advance Received **750**, Allocated **600**, Refunded **150**, Unused **0**. Không được hoàn phần **600** đã trả bill; hóa đơn không đổi |
| A19 | Billing → Security Deposits: hoàn **1.000** rồi **2.750**, reference `QA01-DEP-REF-01/02` | Cọc Collected **3.750**, Refunded **3.750**, Held balance **0**. Có đủ hai lần thu và hai lần hoàn |
| A20 | Cả ba vai trò Refresh/mở lại Account | Lịch sử cước vẫn **5 payment/tổng 950**; Paid bill 2 **350**, Due **4.100,80**. Receipt advance/cọc và các khoản hoàn vẫn ở ledger riêng, không được cộng thành payment cước hoặc xóa nợ |

### Đối soát cuối luồng A

| Nhóm dữ liệu | Số cuối cần thấy |
| --- | --- |
| Cọc | Thu 3.750 − hoàn 3.750 = giữ 0 |
| Advance | Thu 750 − dùng 600 − hoàn 150 = còn 0 |
| Bill 1 | Total 2.525,40; Paid 600; trạng thái RolledOver; Due 0 vì phần 1.925,40 đã chuyển kỳ |
| Bill 2 | Total 4.450,80; Paid 350; Due 4.100,80; PartiallyPaid |
| Payment History toàn Account | 500 Advance + 100 Retail + 200 CityOffice + 100 Advance + 50 CustomerPortal = 950 |
| Các tổng phải tách | 950 là tổng payment hai kỳ; 350 là Paid của bill hiện tại. Không cộng tổng hai hóa đơn để suy ra tiền đã thu |

Nếu dừng test sau A08 để hoàn ngay, advance còn **250**. Nếu chạy tiếp A12 như bảng, advance còn **150**. Chỉ chọn một nhánh trước khi đối chiếu khoản hoàn.

## B. Từ 51 đường truyền: được miễn rồi hủy

Tạo **Order mới** với cùng gói QA, **51 đường**. Không dùng Order 10 đường của luồng A.

| Bước | Thao tác | Kết quả |
| --- | --- | --- |
| B01 | Retail tạo Request và Confirm 51 đường | Cọc gốc **25.500**, bulk 100%, Required **0**. Advance gốc **5.100**, bulk 100%, quote **0**. Thực nhận/số dư cả hai đều **0**, không có Collection |
| B02 | Retail → Security Deposits → Cancel this order, nhập lý do | Order Cancelled; không được kích hoạt. Hai sổ không phát sinh tiền phải hoàn |
| B03 | Billing tìm lại Order trong Security Deposits/Advance Payments | Refundable **0**, không có action Refund để giải ngân. Không tạo phiếu hoàn 0 hoặc hoàn theo cọc gốc 25.500 |
| B04 | Refresh, xem lịch sử và các tổng | Lịch sử hủy còn; không có receipt/refund/payment giả chỉ vì miễn phí |

Để kiểm tra nhánh **đã kích hoạt rồi chấm dứt**, tạo Order 51 đường thứ hai: Technical Feasible → Activate khi cọc Waived, không cần thu tiền giả. Billing phát hành bill: rental **11.475**, thuế **1.404,54**, bill **12.879,54**. Technical Terminate → cọc/advance được hoàn vẫn **0**. Miễn cọc/advance không miễn cước thuê bao. Tiền cước đã trả không được tự hoàn bởi hai sổ này; reversal/hoàn payment cước còn là việc chưa triển khai.

## C. Hủy khi chỉ mới thu một phần

Tạo **Order mới**, một đường Broadband cùng gói QA: cọc phải thu **500**, advance quote **100**.

1. Technical Feasible. Retail thu cọc **200**, advance **30**, ghi hai chứng từ riêng.
2. Chưa đủ cọc nên không Activate. Retail chọn Cancel this order và nhập lý do.
3. Billing chỉ được hoàn cọc tối đa **200**, advance tối đa **30**. Thử hoàn 201 hoặc 31 phải bị chặn, không thêm giao dịch.
4. Hoàn 200 và 30 đúng số dư → cả hai về 0. Các phần cọc 300/advance 70 chưa từng thu không biến thành khoản được hoàn hoặc khoản còn phải thu của đơn đã đóng.
5. Order chưa có Account/bill; không tạo payment cước để thể hiện việc hoàn cọc/advance.

## D. Các ca kiểm tra thêm

| Ca | Cách test và kết quả |
| --- | --- |
| Biên bulk | Tạo quote các Order 9/10/14/15/24/25/50/51 đường. Tỷ lệ lần lượt 0/25/25/50/50/75/75/100%. Rental luôn tính đủ |
| Phạm vi cùng Order | Cùng một khách tạo hai Order, mỗi Order 5 đường: mỗi đơn không giảm bulk. Không cộng lịch sử thành nhóm 10 |
| Policy advance chưa cấu hình | Gói để trống advance: NotConfigured, không tự thu hoặc tạo credit, không thêm điều kiện Activate ngoài cọc |
| Policy advance bằng 0 | Gói advance 0: NotRequired; không thu được và không có credit |
| Snapshot advance | Sau khi Confirm Order 10 đường với mức 100, Admin sửa advance gói lên 200: Order cũ vẫn quote 750, Order được Confirm sau sửa quote 1.500. Không đổi giá rental trong ca này |
| Thu trước Feasible | Thao tác thu cọc/advance không khả dụng; gọi API thu trực tiếp trả 409 |
| Vượt số dư | Thu vượt phần còn phải thu, phân bổ vượt credit/Due, hoàn vượt số thực dư đều bị chặn; số tiền và lịch sử không đổi |
| Phân bổ sai bill | Bill của Account khác không được dùng; bill Paid/RolledOver không nhận allocation |
| Retry ledger | Gửi lại đúng operationId và payload của cọc/advance: không thêm tiền/giao dịch. Cùng ID khác nội dung bị 409. Kiểm tra qua script/API, không suy từ việc bấm lại nút sau khi đã thành công |
| Quyền | Technical/Admin/Customer không được ghi thu/phân bổ/hoàn bằng route nhân viên ngoài quyền. Retail không được hoàn hoặc phân bổ advance. Customer khác không thấy sổ/bill/payment của khách thử |
| Trên 10 payment | Trước khi Terminate, có thể thêm bảy khoản thu mới mỗi khoản 1 USD trên bill 2, ghi bảy note khác nhau. Lịch sử từ 5 thành 12 payment/tổng 957, bill 2 Paid 357/Due 4.093,80. Page 2 có hai bản ghi còn lại; đổi/xóa lọc quay về page 1. Không thực hiện nhánh này rồi tiếp tục đối chiếu số 950/4.100,80 của A20 |

## E. Hồi quy bốn blocker audit

Các ca dưới đây có kiểm thử riêng trong BillingSafetyChecks, frontend payment-retry tests và smoke HTTP. Kết quả luồng A–D không thay thế kiểm thử B01–B04.

| Ca | Kết quả cần giữ | Bản sửa và kiểm thử |
| --- | --- | --- |
| B01 / R2-04 | Nâng từ Review1Billing giữ bill Paid/Unpaid, Amount/PaidAt và account cũ | Archive/import dữ liệu, giữ chứng từ thiếu rõ ràng; EF test từ đúng schema Review 1 |
| B02 / R2-07 | Cùng kỳ hoặc chồng kỳ không tạo invoice thứ hai | 409 trước mutation, BillingVersion kiểm tra write đồng thời; EF và HTTP test |
| B03 / R2-08 | Retry cùng khoản thu không ghi payment mới | OperationId unique/fingerprint, replay sau rollover, payload mismatch 409; client/EF/HTTP test |
| B04 / R2-23 | Guest không đọc được số nợ | Public endpoint/type/UI không có balance; HTTP test cả khi account đang nợ |

Chi tiết request và response: [API](api.md). Không thử migration trên database local đang sử dụng; dữ liệu đã bị xóa ở bản cũ cần backup để phục hồi. Khi gọi payment API thủ công, gửi operationId và giữ mã khi retry. Đối với A07/A10, chọn hai kỳ không chồng lấn.

## F. Chạy lại bộ kiểm thử tự động hiện có

Tại thư mục gốc, dùng bản backend đã build đúng source hiện tại:

```powershell
npm test --prefix frontend
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/smoke.ps1
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore
# Nếu muốn kiểm tra cùng bộ EF/service trên SQL Server LocalDB:
dotnet run --project backend/Nexus.DepositChecks --no-build --no-restore -- --sqlserver
```

Smoke và EF/service tạo database test riêng, có các ca hồi quy B01–B04 như phần E. SQL Server runtime cần chạy thêm ở máy có LocalDB. Để chạy A–D bằng UI, ghi lại ngày/người chạy, Order/Account/bill thực tế, số tiền quan sát, PASS/FAIL và ảnh; đây là luồng hướng dẫn, không phải biên bản xác nhận đã chạy UI.

Tài liệu sâu hơn: [cọc](deposit-flow.md), [advance](advance-flow.md), [payment history](payment-history-flow.md).
