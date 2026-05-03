// File này giúp trình duyệt nhận diện đây là một Ứng dụng (PWA)
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Đã cài đặt');
});

self.addEventListener('fetch', (e) => {
    // Tạm thời bỏ qua, chỉ cần file này tồn tại để điện thoại cho phép cài App
});
