# El At! dağıtım rehberi

El At! bir Next.js sunucusu ve PostgreSQL veritabanıyla çalışır. Bu paket Docker Compose ile tek bir sunucuya kurulur. Caddy alan adına HTTPS sağlar. Telefonlar uygulamaya aynı HTTPS adresinden erişir.

## Gerekenler

- Docker Engine ve Compose eklentisi olan bir Linux sunucusu.
- Sunucunun IP adresine yönlenen bir alan adı, örneğin `elat.example.com`. Sunucuda TCP 80 ve 443 portları Caddy için boş ve erişilebilir olmalı.
- Uygulamanın üretim adresine kayıtlı bir Google OAuth web istemcisi.

## İlk kurulum

1. Proje klasörünü sunucuya kopyalayın. İçinde `Dockerfile`, `compose.yaml`, `deployment/`, `prisma/` ve `src/` bulunmalı.
2. Google Cloud Console'da **Google Auth Platform → Clients → Web application** yoluyla bir istemci oluşturun. **Authorized redirect URIs** alanına `https://elat.example.com/api/auth/callback/google` yazın. Örnekteki alan adını kendi alan adınızla değiştirin. Giriş test kullanıcılarıyla sınırlıysa **Audience** altında kullanacak hesapları ekleyin. [Google OAuth yapılandırması](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)
3. Proje klasöründe yerel üretim ayar dosyanızı oluşturun.

   ```sh
   cp .env.production.example .env.production
   chmod 600 .env.production
   openssl rand -hex 32
   ```

   Rastgele değer üreten komutu dört kez çalıştırın. Her sonucu farklı bir alana koyun. `POSTGRES_PASSWORD`, `POSTGRES_MIGRATION_PASSWORD`, `POSTGRES_APP_PASSWORD` ve `AUTH_SECRET` doldurulmalı. Hex biçimi veritabanı bağlantı adresinin doğru yorumlanmasını sağlar. `ELAT_DOMAIN` alanına yalnızca alan adını yazın. Google'dan aldığınız değerleri `AUTH_GOOGLE_ID` ve `AUTH_GOOGLE_SECRET` alanlarına ekleyin. Bu dosyayı sunucuda saklayın.
4. Ayarları doğrulayıp servisleri başlatın.

   ```sh
   docker compose --env-file .env.production config --quiet
   docker compose --env-file .env.production up --build -d
   docker compose --env-file .env.production ps -a
   ```

   `db` hazır olduğunda `migrate` şemayı ve uygulama erişim izinlerini kurar. Bu servis başarıyla tamamlandığında `Exited (0)` görünür. Ardından `app` ve `proxy` başlar. Uygulama ve veritabanı portları Compose ağı içinde kalır. [Docker Compose başlangıç sırası](https://docs.docker.com/compose/how-tos/startup-order/) · [Caddy HTTPS](https://caddyserver.com/docs/automatic-https)
5. Tarayıcıdan `https://elat.example.com/giris` açın ve Google girişi yapın. Üretim adresiyle bir ebeveyn ve bir çocuk hesabından aileye katılma, görev gönderme ve onaylama akışını deneyin.

## Kontrol ve güncelleme

Uygulamanın sağlığını `https://elat.example.com/api/health` üzerinden kontrol edin. Uygulama veritabanına erişebildiğinde HTTP 200 döner.

Başlangıçta hata olursa önce ilgili servis kayıtlarına bakın.

```sh
docker compose --env-file .env.production logs --tail=100 db migrate app proxy
```

Güncellemeden önce PostgreSQL yedeğini erişimi kısıtlı bir dizinde alın.

```sh
umask 077
docker compose --env-file .env.production exec -T db pg_dump -U postgres -d elat -Fc > elat.dump
```

Yeni proje dosyalarını aktardıktan sonra aynı `up --build -d` komutu ile güncelleyin. `migrate` yalnızca bekleyen şema değişikliklerini uygular. Servisler kapatılıp açıldığında `postgres_data` ve Caddy sertifika volume'ları kalıcıdır.

PostgreSQL hesapları ilk kurulumda oluşturulur. Kurulumdan sonra parola değiştirirken PostgreSQL'deki hesabı da güncelleyin. Mevcut veritabanından veri taşıma sırasında yedeği ayrı bir veritabanına geri yükleyip doğrulayın.

## Barındırma seçenekleri

### Render

Bu paketteki render.yaml, Render Blueprint olarak bir web servisi ve yönetilen PostgreSQL oluşturur. Render Dashboard'da New → Blueprint yoluyla bu dosyanın bulunduğu Git deposunu bağlayın. AUTH_URL alanına Render'ın verdiği HTTPS adresini yazın. AUTH_GOOGLE_ID ve AUTH_GOOGLE_SECRET değerlerini Render Environment ekranında Secret olarak ekleyin. Render servisi açılırken üretim imajı migration'ları çalıştırır ve /api/health kontrolü yeşile döndüğünde trafik almaya başlar.
Docker destekli bir platformda ayrı yönetilen PostgreSQL kullanacaksanız varsayılan `runtime` hedefi uygulama imajıdır. Platformda `DATABASE_URL`, `AUTH_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID` ve `AUTH_GOOGLE_SECRET` tanımlayın. Migration için veritabanı şema yetkisi olan bağlantıyla `npx prisma migrate deploy` çalıştırın. Uygulama için günlük okuma ve yazma izinleri olan ayrı bir bağlantı kullanılabilir. Platformun HTTPS alan adını Google OAuth istemcisine ekleyin.

Docker imajı için ortam değişkenleri çalışma anında verilir. Docker derlemesi ana makinedeki `.env` dosyalarına ihtiyaç duymaz.
