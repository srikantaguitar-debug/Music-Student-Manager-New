const CACHE_NAME = 'music-manager-cache-v3'; // এরপর আপডেট করলে v3, v4 করে দেবেন

// ১. অ্যাপ ইনস্টল হওয়ার সময় বেসিক ফাইলগুলো সেভ করবে
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',   
                '/script.js'    
            ]);
        })
    );
    self.skipWaiting(); // 🟢 খুব জরুরি: নতুন আপডেট এলে সাথে সাথে ইনস্টল হতে বাধ্য করবে
});

// ২. 🟢 নতুন ম্যাজিক: নতুন আপডেট এলে পুরনো ফাইল (যেমন v1) অটোমেটিক মুছে ফেলবে
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // 🟢 খুব জরুরি: অ্যাপকে সাথে সাথে নতুন ভার্সনে শিফট করাবে
});

// ৩. ইন্টারনেট না থাকলে মেমরি থেকে ফাইল লোড করবে
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
