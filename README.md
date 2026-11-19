# El At!

Aile içi ev işlerini görevlere bölen, tamamlamayı ebeveyne doğrulatan ve puanları haftalık sıralamada gösteren web uygulaması.

## Özellikler

- Görünüm ve dil ayarları giriş ekranında ve Ben bölümünde. Açık, Koyu veya Sistem teması, Türkçe, İngilizce veya Basitleştirilmiş Çince seçilir. Tercihler tarayıcıda saklanır.
- Ben sekmesinden profil bilgilerine ve aileye erişim, oturumu kapatma ve onayla kendi El At! hesabını silme. Silme tüm oturumları kapatır ve ailede kalan görev ve puan geçmişinde kimliği kaldırır.
- Hızlı arama. Alt veya yan menüdeki Ara düğmesinden ya da Ctrl/⌘ + K ile ailedeki görevleri ve odaları bul. Görev sonuçları kişinin uygulamadaki görüntüleme yetkisine göre gelir.
- Rol odaklı Bugün ekranı. Çocuk sıradaki işini ve puanını, ebeveyn onay sırasını ve aile toplamını görür.
- Aileye açık görevler. Ebeveyn açar, çocuk tek dokunuşla üstlenir. Her görevi aynı anda yalnızca bir kişi alabilir.
- Ebeveynlere haftalık aile raporu ve Excel uyumlu CSV indirme.
- Google ile giriş ve Auth.js oturum yönetimi
- Aile kurma, davet koduyla katılma ve aile üyesi yönetimi
- Ebeveynin üye rolünü değiştirmesi, üyeyi çıkarması ve davet kodunu yenilemesi. Onaylı görevler ve puan geçmişi korunur.
- Paylaşılan kuş bakışı ev planı. Ebeveyn 25 cm'lik ızgarada oda, duvar, kapı ve pencere çizer. Görev alanına bağlı odalar plandan açılır.
- Ev haritasında puanlı oda ve görev bölgesi oluşturma
- Her alan için dinamik görev puanı: temel puan + temizlenmeden geçen her tam gün; üst sınır temel puanın 3 katı
- Anne/baba tarafından görev oluşturma ve aile üyesine atama
- Açık veya düzeltme bekleyen görevlerin ebeveyn tarafından düzenlenmesi, yeniden atanması ve iptal edilmesi
- Günlük veya haftalık görev planları. Uygun günde Bugün ekranı veya görev panosu ilk açıldığında plan başına bir görev oluşturulur. Geçmiş günler geriye dönük doldurulmaz.
- Çocuğun görevi tamamlandı olarak gönderip ebeveynden onay istemesi
- Onayda puanı değiştirilemez deftere bir kez yazma; reddedilen işi notla yeniden gönderme
- Türkiye saatine göre pazartesi başlayan haftalık puan sıralaması ve toplam puanlar
- Haftalık ödül. Ebeveyn ödülü belirler. Hafta sonunda en yüksek onaylı puanı alanlar kazanır.
- Sunucu tarafı aile/rol denetimleri ve aileler arasında kayıt erişim kontrolü
- Telefonda ana ekrana ekleme ve `/api/health` üzerinden sunucu/veritabanı sağlık kontrolü

## Geliştirme ortamı

Gereksinimler: Node.js 24 LTS, npm ve PostgreSQL (üretim paketi PostgreSQL 17 kullanır).

```bash
npm ci --legacy-peer-deps
Copy-Item .env.example .env
```

`.env` içindeki yer tutucuları kendi geliştirme ortamınla doldur:

- `DATABASE_URL`: PostgreSQL bağlantısı
- `AUTH_SECRET`: `npx auth secret` ile üret
- `AUTH_GOOGLE_ID` ve `AUTH_GOOGLE_SECRET`: Google OAuth istemci bilgileri
- `AUTH_URL`: yerelde `http://localhost:3000`

Google OAuth istemcisinde yönlendirme adresi `http://localhost:3000/api/auth/callback/google` olmalı.

Veritabanı şemasını uygula ve Prisma istemcisini üret:

```bash
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
npx prisma generate
```

Google hesabı olmadan yerel ekranları ve iş akışını denemek için `.env` içinde `AUTH_DEMO_MODE="true"` ve en az 16 karakterlik `AUTH_DEMO_PASSWORD` ayarla. Ardından aşağıdaki örnek aile verisini oluştur:

```bash
node --env-file=.env --import tsx scripts/seed-demo.ts
```

Giriş sayfasındaki demo parolasıyla ebeveyn veya çocuk profili açılır. Demo sağlayıcısı yalnızca `NODE_ENV=development` iken eklenir; üretim yapılandırmasında kullanılmaz. Yerel demo hesapları gerçek Google kullanıcıları değildir.

Geliştirme sunucusunu aç:

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır. Üretim için `npm run build` ve ardından `npm run start` kullanılır.

Bu bilgisayardaki hazır yerel kurulumda masaüstündeki `El At Başlat.cmd` dosyasına çift tıklamak yeterlidir. Başlatıcı yerel PostgreSQL'i gerekirse açar, geliştirme sunucusunu başlatır ve giriş sayfasını tarayıcıda açar.

## Komutlar

```bash
npm run dev          # geliştirme sunucusu
npm run build        # üretim derlemesi
npm run start        # derlenmiş uygulamayı çalıştırma
npm run lint         # ESLint
npm run type-check   # TypeScript tür denetimi
npm test             # Vitest birim testleri
npm run test:e2e     # Playwright uçtan uca testleri
```

Uçtan uca testler için `npx playwright install chromium` çalıştır. Önceden başlatılmış bir test sunucusuyla çalışmak için `PLAYWRIGHT_BASE_URL`, mevcut bir Chromium tabanlı tarayıcı kullanmak için `PLAYWRIGHT_CHROMIUM_EXECUTABLE` tanımlanabilir.

## Mimari

- Next.js App Router, React ve TypeScript
- PostgreSQL, Prisma 7 ve `@prisma/adapter-pg`
- Auth.js v5 ve Google OAuth
- İsteğe bağlı, geliştirme ortamıyla sınırlı demo oturumu (Google OAuth olmadan ekranları incelemek için)
- Tailwind CSS 4; okunabilirlik odaklı Atkinson Hyperlegible yazı tipi
- Sunucu eylemleri önce oturumu doğrular; iş katmanı aile üyeliğini ve rol yetkisini tekrar kontrol eder
- Görev puanı gönderim anında sabitlenir. Puan verme ve oda temizlenme zamanını güncelleme aynı veritabanı transaction'ında gerçekleşir.

Şema değişiklikleri `prisma/migrations` altında tutulur. Üretim paketi, uygulamayı açmadan önce migration'ları dağıtıma ait veritabanına uygular.

## Üretime dağıtım

Docker Compose ile HTTPS kurulumu, Google giriş ayarları, yedekleme ve güncelleme adımları için [dağıtım kılavuzuna](DEPLOY.md) bak.
