const CACHE_NAME = 'teacher-mobile-v2';

const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];


/*
 * =====================================================
 * INSTALL
 * =====================================================
 */
self.addEventListener('install', event => {

  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(APP_SHELL);
      })
      .catch(error => {
        console.warn(
          'TeacherPR Mobile cache install failed',
          error
        );
      })
  );

});


/*
 * =====================================================
 * ACTIVATE
 * ลบ Cache version เก่า
 * =====================================================
 */
self.addEventListener('activate', event => {

  event.waitUntil(
    Promise.all([

      caches
        .keys()
        .then(keys => {
          return Promise.all(
            keys
              .filter(key => {
                return key !== CACHE_NAME;
              })
              .map(key => {
                return caches.delete(key);
              })
          );
        }),

      self.clients.claim()

    ])
  );

});


/*
 * =====================================================
 * FETCH
 *
 * ใช้ Network First
 * ถ้า Network ไม่ได้ค่อยใช้ Cache
 * =====================================================
 */
self.addEventListener('fetch', event => {

  const request =
    event.request;


  /*
   * รับเฉพาะ GET
   */
  if(
    request.method !== 'GET'
  ){
    return;
  }


  const url =
    new URL(request.url);


  /*
   * =====================================================
   * ไม่ยุ่งกับ CDN / Google Fonts / Supabase
   *
   * ปล่อย Browser จัดการเอง
   * =====================================================
   */
  if(
    url.origin !==
    self.location.origin
  ){
    return;
  }


  /*
   * =====================================================
   * Navigation เช่น
   *
   * /TeacherPR-mobile/
   *
   * Network First
   * ถ้า offline ใช้หน้า ./ ที่ cache ไว้
   * =====================================================
   */
  if(
    request.mode === 'navigate'
  ){

    event.respondWith(

      fetch(request)

        .then(async response => {

          /*
           * เก็บหน้าใหม่ล่าสุดลง Cache
           */
          if(
            response &&
            response.ok
          ){

            const cache =
              await caches.open(
                CACHE_NAME
              );


            await cache.put(
              request,
              response.clone()
            );

          }


          return response;

        })

        .catch(async () => {

          /*
           * 1) หา request เดิมก่อน
           */
          const cached =
            await caches.match(
              request
            );


          if(cached){

            return cached;

          }


          /*
           * 2) fallback ไปหน้า root
           * ของ TeacherPR-mobile
           *
           * ไม่ใช่ root ของ GitHub Pages
           */
          const appShell =
            await caches.match(
              './'
            );


          if(appShell){

            return appShell;

          }


          /*
           * สำคัญ:
           * respondWith ต้องได้ Response เสมอ
           */
          return new Response(
            `
              <!doctype html>
              <html lang="th">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport"
                        content="width=device-width,initial-scale=1">
                  <title>TeacherPR Offline</title>
                </head>

                <body style="
                  font-family:sans-serif;
                  padding:30px;
                  text-align:center;
                ">
                  <h2>ไม่สามารถเชื่อมต่อระบบได้</h2>
                  <p>
                    กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
                    แล้วลองใหม่อีกครั้ง
                  </p>
                </body>
              </html>
            `,
            {
              status: 503,
              statusText: 'Offline',
              headers: {
                'Content-Type':
                  'text/html; charset=utf-8'
              }
            }
          );

        })

    );


    return;

  }


  /*
   * =====================================================
   * Static files
   *
   * เช่น manifest / icons / js / css
   * =====================================================
   */
  event.respondWith(

    fetch(request)

      .then(async response => {

        /*
         * Cache เฉพาะ response ที่สำเร็จ
         */
        if(
          response &&
          response.ok
        ){

          const cache =
            await caches.open(
              CACHE_NAME
            );


          await cache.put(
            request,
            response.clone()
          );

        }


        return response;

      })

      .catch(async () => {

        /*
         * ใช้ Cache ถ้ามี
         */
        const cached =
          await caches.match(
            request
          );


        if(cached){

          return cached;

        }


        /*
         * ห้ามคืน undefined
         */
        return new Response(
          '',
          {
            status: 504,
            statusText:
              'Offline'
          }
        );

      })

  );

});
