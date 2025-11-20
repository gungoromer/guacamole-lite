# Guacamole Bağlantı Linki Oluşturma Rehberi

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Token Yapısı](#token-yapısı)
3. [Client-Side Token Oluşturma](#client-side-token-oluşturma)
4. [Server-Side Token Oluşturma (Önerilen)](#server-side-token-oluşturma)
5. [Bağlantı URL'i Formatı](#bağlantı-urli-formatı)
6. [Güvenlik Özellikleri](#güvenlik-özellikleri)
7. [Kullanım Senaryoları](#kullanım-senaryoları)

---

## Genel Bakış

Guacamole bağlantı linki oluşturmak için **şifrelenmiş token** kullanılır. Token, bağlantı bilgilerini (sunucu adresi, kullanıcı adı, şifre vb.) güvenli bir şekilde içerir.

### Temel Akış:
```
1. Token Oluştur (bağlantı bilgilerini şifrele)
   ↓
2. URL Oluştur (token'ı URL'e ekle)
   ↓
3. Kullanıcıya Gönder
   ↓
4. Kullanıcı URL'e Tıklar
   ↓
5. Otomatik Bağlantı Kurulur
```

---

## Token Yapısı

Token, aşağıdaki bilgileri içerir:

```javascript
{
  connection: {
    type: 'rdp',              // Protokol: rdp, vnc, ssh, telnet
    guacdHost: 'guacd-1',     // guacd sunucu adresi
    guacdPort: 4822,          // guacd port
    settings: {
      hostname: '10.10.10.207',     // Hedef sunucu
      username: 'Administrator',     // Kullanıcı adı
      password: 'P@ssw0rd',         // Şifre
      port: 3389,                   // RDP port
      'ignore-cert': true,          // Sertifika kontrolü
      'security': 'any',
      'enable-wallpaper': false
    }
  },
  exp: 1763679900000,  // Geçerlilik süresi (timestamp)
  iat: 1763679000000   // Oluşturulma zamanı (timestamp)
}
```

---

## Client-Side Token Oluşturma

> ⚠️ **UYARI**: Client-side token oluşturma sadece **demo/test** amaçlıdır. Production ortamlarında **server-side** kullanın!

### JavaScript Kodu:

```javascript
async function generateGuacamoleToken(tokenObj, expirationMinutes = 15) {
  const CIPHER = 'AES-256-CBC';
  const KEY = new TextEncoder().encode('MySuperSecretKeyForParamsToken12');

  // Expiration ve issued-at timestamp ekle
  const now = Date.now();
  const tokenWithExpiration = {
    ...tokenObj,
    exp: now + (expirationMinutes * 60 * 1000), // Geçerlilik süresi
    iat: now // Oluşturulma zamanı
  };

  // AES-256-CBC ile şifrele
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const algo = { name: "AES-CBC", iv };
  const key = await crypto.subtle.importKey("raw", KEY, algo, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt(algo, key,
    new TextEncoder().encode(JSON.stringify(tokenWithExpiration))));

  // Base64 encode
  const token = btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    value: btoa(String.fromCharCode(...ct))
  }));

  return token;
}
```

### Kullanım Örneği:

```javascript
// 1. Bağlantı bilgilerini hazırla
const connectionInfo = {
  connection: {
    type: 'rdp',
    guacdHost: 'guacd-1',
    guacdPort: 4822,
    settings: {
      hostname: '10.10.10.207',
      username: 'Administrator',
      password: 'P@ssw0rd',
      port: 3389,
      'ignore-cert': true,
      'security': 'any',
      'enable-wallpaper': false
    }
  }
};

// 2. Token oluştur (15 dakika geçerli)
const token = await generateGuacamoleToken(connectionInfo, 15);

// 3. URL oluştur
const url = `http://localhost:9090/autoconnect.html?token=${token}`;

// 4. Kullanıcıyı yönlendir
window.location.href = url;
// veya
window.open(url, '_blank');
```

---

## Server-Side Token Oluşturma

> ✅ **ÖNERİLEN**: Production ortamları için server-side token oluşturma kullanın!

### Node.js/Express Örneği:

```javascript
const crypto = require('crypto');

class TokenGenerator {
  constructor(encryptionKey) {
    this.cipher = 'AES-256-CBC';
    this.key = Buffer.from(encryptionKey, 'utf8');
  }

  encrypt(jsonData) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.cipher, this.key, iv);

    let encrypted = cipher.update(JSON.stringify(jsonData), 'utf8', 'binary');
    encrypted += cipher.final('binary');

    const data = {
      iv: Buffer.from(iv).toString('base64'),
      value: Buffer.from(encrypted, 'binary').toString('base64')
    };

    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  generateToken(connectionInfo, expirationMinutes = 15) {
    const now = Date.now();
    const tokenData = {
      ...connectionInfo,
      exp: now + (expirationMinutes * 60 * 1000),
      iat: now
    };

    return this.encrypt(tokenData);
  }
}

// Express API Endpoint
app.post('/api/generate-connection-token', authenticate, async (req, res) => {
  try {
    // 1. Kullanıcı yetkisini kontrol et
    const user = req.user;
    const serverId = req.body.serverId;

    if (!user.canAccessServer(serverId)) {
      return res.status(403).json({ error: 'Erişim reddedildi' });
    }

    // 2. Sunucu bilgilerini veritabanından al
    const server = await db.getServer(serverId);

    // 3. Token oluştur
    const tokenGenerator = new TokenGenerator(process.env.ENCRYPTION_KEY);
    const token = tokenGenerator.generateToken({
      connection: {
        type: server.protocol,
        guacdHost: server.guacdHost,
        guacdPort: server.guacdPort,
        settings: {
          hostname: server.hostname,
          username: server.username,
          password: decrypt(server.encryptedPassword), // DB'de şifreli
          port: server.port,
          'ignore-cert': true,
          'security': 'any'
        }
      }
    }, 15); // 15 dakika geçerli

    // 4. Audit log
    await db.logConnectionRequest(user.id, serverId);

    // 5. Token'ı döndür
    res.json({ token });

  } catch (error) {
    console.error('Token oluşturma hatası:', error);
    res.status(500).json({ error: 'Token oluşturulamadı' });
  }
});
```

### Frontend Kullanımı:

```javascript
async function connectToServer(serverId) {
  try {
    // 1. Backend'den token iste
    const response = await fetch('/api/generate-connection-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({ serverId })
    });

    if (!response.ok) {
      throw new Error('Token alınamadı');
    }

    const { token } = await response.json();

    // 2. Bağlantı URL'i oluştur
    const baseUrl = 'https://guacamole.example.com';
    const connectionUrl = `${baseUrl}/autoconnect.html?token=${token}`;

    // 3. Yeni pencerede aç
    window.open(connectionUrl, '_blank');

  } catch (error) {
    console.error('Bağlantı hatası:', error);
    alert('Bağlantı kurulamadı');
  }
}
```

---

## Bağlantı URL'i Formatı

### Temel Format:
```
http://[GUACAMOLE_HOST]/autoconnect.html?token=[ENCRYPTED_TOKEN]
```

### Örnekler:

**Localhost (Development):**
```
http://localhost:9090/autoconnect.html?token=eyJpdiI6IjNwZXFRSE9KemhCblRjeUxsUVVHTGc9PSIsInZhbHVlIjoiUHUyM0xpdWJBKzBmZk5kUngxNzRsVG5JeDBxMjRNR2pDTjcyLzRSOTRxRktwcGRKZlpqeHlOMFBsd3o5QXRnSmNlVGM2OGw0VE02TGpSRmhsNURocXB2ZmRJUklDejhXdE9SY0VhR0IzejFSMXpiR1V5WU9TVWtyRGRhVGYrcUNta3M5SWlXSytWNVF5S0lZdVFlYUtMZUNVbUNzRjlRNG1HcXBpcGRjSFRsa1owclpzdmd5T2lWdUlKK3VGWVppVjRsY2x5dk53L1BsdDNlc0pCK25BZXFseVQ3RnBlWHRQUkRWQnVtNDVFZG9OZFMydTF3aEh0S0l6YVhtc2Urc3VoRUJENExpbGY1L0xuS1NNVVpzbUplcTBXWkR1QS9SaWdzRXRERmpGL2RFUGxCbWpFUHZZNDV3MzB4Q2IvSXB3UTN5VmU2OXlQQnMwM1hZN3YxMVRjV1VtdWNUbjFWdjJ4cVlvYktxNFhkSXNGZHQxZVR1QzZGSlB4Y3VINlpaaGEzZjJyNjM5OHdLd2dITm1aUloyaU4rUER1bVVQNWZPVGtvanhIeXVkK2wwc1Y4WjdCUllBWUlhSVdnTGxUayJ9
```

**Production (HTTPS):**
```
https://guacamole.example.com/autoconnect.html?token=eyJpdiI6IjNwZXFRSE9KemhCblRjeUxsUVVHTGc9PSIsInZhbHVlIjoiUHUyM0xpdWJBKzBmZk5kUngxNzRsVG5JeDBxMjRNR2pDTjcyLzRSOTRxRktwcGRKZlpqeHlOMFBsd3o5QXRnSmNlVGM2OGw0VE02TGpSRmhsNURocXB2ZmRJUklDejhXdE9SY0VhR0IzejFSMXpiR1V5WU9TVWtyRGRhVGYrcUNta3M5SWlXSytWNVF5S0lZdVFlYUtMZUNVbUNzRjlRNG1HcXBpcGRjSFRsa1owclpzdmd5T2lWdUlKK3VGWVppVjRsY2x5dk53L1BsdDNlc0pCK25BZXFseVQ3RnBlWHRQUkRWQnVtNDVFZG9OZFMydTF3aEh0S0l6YVhtc2Urc3VoRUJENExpbGY1L0xuS1NNVVpzbUplcTBXWkR1QS9SaWdzRXRERmpGL2RFUGxCbWpFUHZZNDV3MzB4Q2IvSXB3UTN5VmU2OXlQQnMwM1hZN3YxMVRjV1VtdWNUbjFWdjJ4cVlvYktxNFhkSXNGZHQxZVR1QzZGSlB4Y3VINlpaaGEzZjJyNjM5OHdLd2dITm1aUloyaU4rUER1bVVQNWZPVGtvanhIeXVkK2wwc1Y4WjdCUllBWUlhSVdnTGxUayJ9
```

---

## Güvenlik Özellikleri

### 1. Token Expiration (Geçerlilik Süresi)
- **Varsayılan**: 15 dakika
- **Ayarlanabilir**: 1 dakika - 24 saat arası
- **Sunucu Tarafı Doğrulama**: Token süresi dolmuşsa bağlantı reddedilir

```javascript
// 5 dakikalık token
const token = await generateGuacamoleToken(connectionInfo, 5);

// 30 dakikalık token
const token = await generateGuacamoleToken(connectionInfo, 30);

// 1 saatlik token
const token = await generateGuacamoleToken(connectionInfo, 60);
```

### 2. One-Time Use (Tek Kullanımlık)
- Her token **sadece bir kez** kullanılabilir
- İkinci kullanım denemesi **otomatik olarak reddedilir**
- SHA-256 hash ile token tracking
- Otomatik cleanup (24 saat sonra)

### 3. AES-256-CBC Şifreleme
- Endüstri standardı şifreleme
- 256-bit encryption key
- Random IV (Initialization Vector) her token için
- Brute-force saldırılara karşı korumalı

### 4. Güvenlik Kontrol Listesi

#### ✅ Yapılması Gerekenler:
- [ ] **HTTPS kullan** (production için zorunlu)
- [ ] **Encryption key'i environment variable'da tut**
- [ ] **Backend'de token oluştur** (client-side değil)
- [ ] **Kullanıcı authentication/authorization ekle**
- [ ] **Rate limiting uygula**
- [ ] **Audit logging ekle**
- [ ] **Sunucu şifrelerini DB'de encrypted tut**

#### ❌ Yapılmaması Gerekenler:
- [ ] Client-side'da encryption key tutma
- [ ] HTTP kullanma (production'da)
- [ ] Token'ları log dosyalarına yazma
- [ ] Sınırsız geçerlilik süresi verme
- [ ] Şifreleri plain text olarak saklama

---

## Kullanım Senaryoları

### Senaryo 1: Web Dashboard'dan Bağlantı

```javascript
// Dashboard'da "Bağlan" butonu
document.getElementById('connect-btn').addEventListener('click', async () => {
  const serverId = document.getElementById('server-select').value;
  
  // Backend'den token al
  const response = await fetch('/api/generate-connection-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverId })
  });
  
  const { token } = await response.json();
  
  // Yeni pencerede aç
  const url = `https://guacamole.example.com/autoconnect.html?token=${token}`;
  window.open(url, '_blank', 'width=1280,height=800');
});
```

### Senaryo 2: Email ile Link Gönderme

```javascript
// Backend: Email ile bağlantı linki gönder
app.post('/api/send-connection-link', authenticate, async (req, res) => {
  const { serverId, recipientEmail, expirationMinutes } = req.body;
  
  // Token oluştur
  const tokenGenerator = new TokenGenerator(process.env.ENCRYPTION_KEY);
  const server = await db.getServer(serverId);
  const token = tokenGenerator.generateToken({
    connection: { /* ... */ }
  }, expirationMinutes || 60); // 1 saat geçerli
  
  // URL oluştur
  const url = `https://guacamole.example.com/autoconnect.html?token=${token}`;
  
  // Email gönder
  await sendEmail({
    to: recipientEmail,
    subject: 'Sunucu Bağlantı Linki',
    html: `
      <h2>Sunucu Bağlantısı</h2>
      <p>Aşağıdaki linke tıklayarak sunucuya bağlanabilirsiniz:</p>
      <a href="${url}">Bağlan</a>
      <p><small>Bu link ${expirationMinutes} dakika geçerlidir.</small></p>
    `
  });
  
  res.json({ success: true });
});
```

### Senaryo 3: QR Code ile Bağlantı

```javascript
// QR Code oluştur
import QRCode from 'qrcode';

app.post('/api/generate-qr-connection', authenticate, async (req, res) => {
  const { serverId } = req.body;
  
  // Token oluştur
  const token = await generateToken(serverId);
  const url = `https://guacamole.example.com/autoconnect.html?token=${token}`;
  
  // QR code oluştur
  const qrCodeDataUrl = await QRCode.toDataURL(url);
  
  res.json({ qrCode: qrCodeDataUrl, url });
});
```

### Senaryo 4: Iframe ile Embed

```html
<!-- Dashboard içinde iframe olarak göster -->
<iframe 
  id="guacamole-frame"
  width="1024" 
  height="768"
  frameborder="0"
  style="border: 1px solid #ccc;">
</iframe>

<script>
async function embedGuacamole(serverId) {
  // Token al
  const response = await fetch('/api/generate-connection-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverId })
  });
  
  const { token } = await response.json();
  
  // Iframe'e yükle
  const iframe = document.getElementById('guacamole-frame');
  iframe.src = `https://guacamole.example.com/autoconnect.html?token=${token}`;
}
</script>
```

---

## Protokol Örnekleri

### RDP Bağlantısı

```javascript
{
  connection: {
    type: 'rdp',
    guacdHost: 'guacd-1',
    guacdPort: 4822,
    settings: {
      hostname: '192.168.1.100',
      username: 'Administrator',
      password: 'SecurePassword123',
      port: 3389,
      'ignore-cert': true,
      'security': 'any',
      'enable-wallpaper': false,
      'enable-theming': false,
      'enable-font-smoothing': false,
      'enable-full-window-drag': false,
      'enable-desktop-composition': false,
      'enable-menu-animations': false
    }
  }
}
```

### VNC Bağlantısı

```javascript
{
  connection: {
    type: 'vnc',
    guacdHost: 'guacd-1',
    guacdPort: 4822,
    settings: {
      hostname: '192.168.1.101',
      port: 5900,
      password: 'VncPassword123',
      'color-depth': 24,
      'swap-red-blue': false,
      'cursor': 'remote',
      'read-only': false
    }
  }
}
```

### SSH Bağlantısı

```javascript
{
  connection: {
    type: 'ssh',
    guacdHost: 'guacd-1',
    guacdPort: 4822,
    settings: {
      hostname: '192.168.1.102',
      port: 22,
      username: 'root',
      password: 'SshPassword123',
      // veya private key kullan:
      // 'private-key': '-----BEGIN RSA PRIVATE KEY-----\n...',
      'font-name': 'monospace',
      'font-size': 12,
      'color-scheme': 'gray-black'
    }
  }
}
```

---

## Hata Yönetimi

### Client-Side Hata Kontrolü

```javascript
async function connectWithErrorHandling(serverId) {
  try {
    const response = await fetch('/api/generate-connection-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Bu sunucuya erişim yetkiniz yok');
      } else if (response.status === 404) {
        throw new Error('Sunucu bulunamadı');
      } else {
        throw new Error('Token oluşturulamadı');
      }
    }

    const { token } = await response.json();
    const url = `https://guacamole.example.com/autoconnect.html?token=${token}`;
    window.open(url, '_blank');

  } catch (error) {
    console.error('Bağlantı hatası:', error);
    alert(error.message);
  }
}
```

### Server-Side Hata Logları

Token validation hataları server loglarında görünür:

```
[2025-11-20 23:00:14] [Connection #4]  Token validation failed
[2025-11-20 23:00:14] [Connection #4]  Token expired 120 seconds ago
```

veya

```
[2025-11-20 23:00:14] [Connection #4]  Token already used 45 seconds ago
```

---

## Özet

### Hızlı Başlangıç (3 Adım):

1. **Token Oluştur**:
   ```javascript
   const token = await generateGuacamoleToken(connectionInfo, 15);
   ```

2. **URL Oluştur**:
   ```javascript
   const url = `https://guacamole.example.com/autoconnect.html?token=${token}`;
   ```

3. **Kullanıcıyı Yönlendir**:
   ```javascript
   window.open(url, '_blank');
   ```

### Önemli Noktalar:

✅ **Token 15 dakika geçerli** (ayarlanabilir)  
✅ **Her token sadece 1 kez kullanılabilir**  
✅ **AES-256-CBC şifreleme**  
✅ **HTTPS kullanın** (production için)  
✅ **Backend'de token oluşturun**  

---

## Destek ve Dokümantasyon

- **Demo Sayfası**: http://localhost:9095 (external-requester)
- **Autoconnect Sayfası**: http://localhost:9090/autoconnect.html
- **Token Generator**: `test-guac/guacamole-lite-client/html/js/token-generator.js`
- **Server Implementation**: `lib/Server.js`, `lib/ClientConnection.js`
