# Frontend Nexus

Thư mục dành cho ứng dụng React + Vite của nhóm. Review 1 chạy API mode mặc định trong trình duyệt; đặt `VITE_USE_MOCK=true` chỉ khi cần quay lại fixture cho UI/unit test.

Khi tích hợp, chạy backend demo theo [README dự án](../README.md). Vite proxy chuyển `/api` tới `http://127.0.0.1:5168`. Gọi API bằng đường dẫn tương đối `/api/...` để dùng cookie phiên qua cùng origin. FE đọc `GET /api/session` để lấy token CSRF trước lần ghi đầu tiên và đọc lại sau đăng nhập hoặc đăng xuất; token được gửi trong header `X-CSRF-Token` khi gọi POST, PUT hoặc DELETE.

Xem [API contract](../docs/api.md) để biết vai trò, payload và mã phản hồi.
