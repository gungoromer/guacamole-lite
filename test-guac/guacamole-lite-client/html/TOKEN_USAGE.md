# Encrypted Token Authentication for Autoconnect

## Overview

The `autoconnect.html` page now supports **encrypted token-based authentication**, which keeps connection credentials secure instead of exposing them in plain text in the URL.

## How It Works

### Option 1: Encrypted Token (RECOMMENDED - SECURE)

External projects can generate an encrypted token and pass it to `autoconnect.html`:

```
autoconnect.html?token=ENCRYPTED_TOKEN&protocol=rdp&guacd=guacd-1:4822
```

### Option 2: Plain Parameters (FALLBACK - INSECURE)

For backward compatibility, plain parameters still work:

```
autoconnect.html?host=SERVER&user=USERNAME&pass=PASSWORD&protocol=rdp&guacd=guacd-1:4822
```

⚠️ **WARNING**: This method exposes credentials in the URL and should only be used for testing.

---

## Generating Tokens in External Projects

To use encrypted tokens, you need to replicate the `generateGuacamoleToken()` function in your external project.

### JavaScript/Node.js Example

```javascript
async function generateGuacamoleToken(tokenObj) {
  const CIPHER = 'AES-256-CBC';
  const KEY = new TextEncoder().encode('MySuperSecretKeyForParamsToken12');

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const algo = { name: "AES-CBC", iv };
  const key = await crypto.subtle.importKey("raw", KEY, algo, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt(algo, key,
                      new TextEncoder().encode(JSON.stringify(tokenObj))));

  const token = btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    value: btoa(String.fromCharCode(...ct))
  }));

  return token;
}

// Example usage
const tokenObj = {
  connection: {
    type: "rdp",
    guacdHost: "guacd-1",
    guacdPort: 4822,
    settings: {
      hostname: "your-server.com",
      username: "your-username",
      password: "your-password",
      "ignore-cert": true,
      security: "any",
      "enable-drive": true,
      "drive-path": "/tmp/guac-drive",
      "create-drive-path": true,
      "enable-printing": true,
      audio: ["audio/L16;rate=44100"]
    }
  }
};

const token = await generateGuacamoleToken(tokenObj);
const url = `http://your-server/autoconnect.html?token=${encodeURIComponent(token)}&protocol=rdp&guacd=guacd-1:4822`;
// Redirect user to this URL
window.location.href = url;
```

### Python Example (using cryptography library)

```python
import json
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

def generate_guacamole_token(token_obj):
    # Same key as in JavaScript (32 bytes for AES-256)
    KEY = b'MySuperSecretKeyForParamsToken12'
    
    # Generate random IV
    iv = os.urandom(16)
    
    # Create cipher
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    
    # Encrypt the token object
    plaintext = json.dumps(token_obj).encode('utf-8')
    
    # Add PKCS7 padding
    padding_length = 16 - (len(plaintext) % 16)
    plaintext += bytes([padding_length] * padding_length)
    
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    # Create token structure
    token_data = {
        'iv': base64.b64encode(iv).decode('utf-8'),
        'value': base64.b64encode(ciphertext).decode('utf-8')
    }
    
    # Base64 encode the entire structure
    token = base64.b64encode(json.dumps(token_data).encode('utf-8')).decode('utf-8')
    return token

# Example usage
token_obj = {
    "connection": {
        "type": "rdp",
        "guacdHost": "guacd-1",
        "guacdPort": 4822,
        "settings": {
            "hostname": "your-server.com",
            "username": "your-username",
            "password": "your-password",
            "ignore-cert": True,
            "security": "any",
            "enable-drive": True,
            "drive-path": "/tmp/guac-drive",
            "create-drive-path": True,
            "enable-printing": True,
            "audio": ["audio/L16;rate=44100"]
        }
    }
}

token = generate_guacamole_token(token_obj)
url = f"http://your-server/autoconnect.html?token={token}&protocol=rdp&guacd=guacd-1:4822"
# Redirect user to this URL
```

---

## Token Object Structure

The token object must follow this structure:

```javascript
{
  connection: {
    type: "rdp" | "vnc",           // Protocol type
    guacdHost: "guacd-1",          // guacd hostname
    guacdPort: 4822,               // guacd port
    settings: {
      hostname: "server-address",   // Remote server
      username: "username",         // Login username
      password: "password",         // Login password
      
      // RDP-specific settings
      "ignore-cert": true,
      "security": "any",
      "enable-drive": true,
      "drive-path": "/tmp/guac-drive",
      "create-drive-path": true,
      "enable-printing": true,
      "audio": ["audio/L16;rate=44100"]
    }
  }
}
```

---

## Security Notes

1. **Encryption Key**: The encryption key (`MySuperSecretKeyForParamsToken12`) is currently hardcoded. For production use, you should:
   - Use a strong, randomly generated key
   - Store it securely (environment variables, secrets manager)
   - Ensure the same key is used in both the token generator and the guacamole-lite server

2. **HTTPS**: Always use HTTPS in production to prevent token interception

3. **Token Expiration**: Consider adding timestamp validation to prevent token replay attacks

4. **Key Rotation**: Implement key rotation policies for enhanced security

---

## Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `token` | No* | - | Encrypted connection token |
| `host` | No* | - | Remote server hostname (fallback mode) |
| `user` | No* | - | Username (fallback mode) |
| `pass` | No* | - | Password (fallback mode) |
| `protocol` | No | `rdp` | Connection protocol (`rdp` or `vnc`) |
| `guacd` | No | `guacd-1:4822` | guacd instance (format: `host:port`) |

*Either `token` OR all of (`host`, `user`, `pass`) must be provided.

---

## Example Integration

### From a Web Application

```html
<!DOCTYPE html>
<html>
<head>
  <title>Launch Remote Desktop</title>
  <script src="token-generator.js"></script>
</head>
<body>
  <button onclick="launchRemoteDesktop()">Connect to Server</button>
  
  <script>
    async function launchRemoteDesktop() {
      const tokenObj = {
        connection: {
          type: "rdp",
          guacdHost: "guacd-1",
          guacdPort: 4822,
          settings: {
            hostname: "production-server.company.com",
            username: "admin",
            password: "SecurePassword123!",
            "ignore-cert": true,
            "security": "any"
          }
        }
      };
      
      const token = await generateGuacamoleToken(tokenObj);
      const url = `http://guacamole-server/autoconnect.html?token=${encodeURIComponent(token)}`;
      
      // Open in new window
      window.open(url, '_blank', 'width=1280,height=720');
    }
  </script>
</body>
</html>
```

### From a Backend API

```javascript
// Express.js example
app.get('/api/get-rdp-url', async (req, res) => {
  const { serverId } = req.query;
  
  // Fetch server credentials from database
  const server = await db.getServer(serverId);
  
  const tokenObj = {
    connection: {
      type: "rdp",
      guacdHost: "guacd-1",
      guacdPort: 4822,
      settings: {
        hostname: server.hostname,
        username: server.username,
        password: server.password,
        "ignore-cert": true,
        "security": "any"
      }
    }
  };
  
  const token = await generateGuacamoleToken(tokenObj);
  const url = `https://guacamole.company.com/autoconnect.html?token=${encodeURIComponent(token)}`;
  
  res.json({ url });
});
```

---

## Testing

### Test with Token (Secure)
1. Generate a token using the examples above
2. Navigate to: `autoconnect.html?token=YOUR_ENCRYPTED_TOKEN`

### Test with Plain Parameters (Insecure - for testing only)
```
autoconnect.html?host=desktop-linux&user=testuser&pass=Passw0rd!&protocol=rdp&guacd=guacd-1:4822
```
