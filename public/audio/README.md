# Thư mục Audio Gốc Vol 1 – Vol 10 (`public/audio/`)

Đặt các file audio gốc (`.mp3`, `.wav`, `.m4a`, `.mp4`, `.ogg`) bổ sung theo từng thư mục `vol-1/` đến `vol-10/` để ứng dụng ánh xạ trực tiếp làm nguồn âm thanh cho cả **Listening** và **Dictation**.

## Quy ước đặt tên khuyến nghị (cho Batch Importer tự nhận diện)
- 1 file cho cả Test: `Vol10_Test1.mp3`, `Vol10_Test2.mp3`
- 4 file tách theo Part: `Vol1_Test1_Part1.mp3`, `Vol1_Test1_Part2.mp3`, `Vol1_Test1_Part3.mp3`, `Vol1_Test1_Part4.mp3`

> Lưu ý: Các file audio gốc sẵn có tại `F:\IELTS\Vol\Full Original Exam VOL 1-10` được phục vụ trực tiếp qua endpoint `/vol-archive/...` mà không cần copy nhân đôi dung lượng. Riêng các file `.wma` (không được trình duyệt HTML5 hỗ trợ phát trực tiếp) có thể chuyển sang `.mp3` / `.m4a` hoặc gắn trực tiếp từ giao diện web (lưu vào IndexedDB).
