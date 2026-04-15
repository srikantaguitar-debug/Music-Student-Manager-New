const CACHE_NAME = 'music-manager-cache-v2'; // v2 করা হলো যাতে নতুন ফাইলগুলো ক্যাশ হয়

// অ্যাপ ইনস্টল হওয়ার সময় বেসিক ফাইলগুলো সেভ করবে
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',   // 🟢 আপনার CSS ফাইলের নাম যদি অন্য হয়, তবে সেটা দেবেন
                '/script.js'    // 🟢 আপনার JS ফাইলের নাম যদি অন্য হয়, তবে সেটা দেবেন
            ]);
        })
    );
});

// ইন্টারনেট না থাকলে মেমরি থেকে ফাইল লোড করবে
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => {
            console.log('Offline and resource not found in cache.');
        })
    );
});
