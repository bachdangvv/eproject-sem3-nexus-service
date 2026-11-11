# Frontend Nexus

Thư mục dành cho ứng dụng React + Vite của nhóm.

Khi tích hợp, chạy backend demo theo [README dự án](../README.md) và cấu hình Vite proxy chuyển `/api` tới `http://127.0.0.1:5168`. Gọi API bằng đường dẫn tương đối `/api/...` để dùng cookie phiên qua cùng origin. Đọc `GET /api/session` để lấy token CSRF trước lần ghi đầu tiên và đọc lại sau đăng nhập hoặc đăng xuất. Gửi token hiện tại trong header `X-CSRF-Token` khi gọi POST, PUT hoặc DELETE.

Xem [API contract](../docs/api.md) để biết vai trò, payload và mã phản hồi.
