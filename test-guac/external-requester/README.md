# External Integration Example

This folder contains a complete working example for developers who want to integrate Guacamole remote desktop connections into their external applications.

## 📁 What's Inside

- **index.html** - A fully functional demo page with:
  - Working token generator
  - Interactive form to test connections
  - Complete code examples (client-side and server-side)
  - Copy-paste ready integration code
  - Beautiful UI for easy testing

## 🚀 Quick Start

1. Open `index.html` in your browser
2. Fill in the connection details (or use the pre-filled test values)
3. Click "Generate & Connect" to test the integration
4. Copy the integration code from the page to use in your project

## 📖 How to Use This for Integration

### For Frontend Developers

1. Copy the `generateGuacamoleToken()` function from the page
2. Use it in your application to generate encrypted tokens
3. Redirect users to `autoconnect.html?token=YOUR_TOKEN`

### For Backend Developers

1. Implement the token generation on your server (see Node.js example in index.html)
2. Create an API endpoint that returns the connection URL
3. Your frontend calls this API and redirects users to the returned URL

## 🔐 Security Best Practices

1. **Never hardcode credentials** - Fetch them from your secure database
2. **Use environment variables** for the encryption key
3. **Always use HTTPS** in production
4. **Implement token expiration** for additional security
5. **Validate user permissions** before generating tokens

## 📋 Integration Checklist

- [ ] Copy the `generateGuacamoleToken()` function to your project
- [ ] Update the encryption key (use environment variable)
- [ ] Test token generation with sample data
- [ ] Implement your connection logic
- [ ] Test the full flow from your app to Guacamole
- [ ] Implement proper error handling
- [ ] Add logging for debugging
- [ ] Security review before production deployment

## 🔗 Related Files

- `../guacamole-lite-client/html/autoconnect.html` - The target page that accepts tokens
- `../guacamole-lite-client/html/js/token-generator.js` - Original token generator
- `../guacamole-lite-client/html/TOKEN_USAGE.md` - Detailed documentation

## 💡 Example Use Cases

### Use Case 1: Web Application Dashboard
```javascript
// User clicks "Connect to Server" button in your dashboard
async function handleConnectClick(serverId) {
  const server = await fetchServerDetails(serverId);
  
  const tokenObj = {
    connection: {
      type: "rdp",
      guacdHost: "guacd-1",
      guacdPort: 4822,
      settings: {
        hostname: server.ip,
        username: server.username,
        password: server.password,
        "ignore-cert": true,
        "security": "any"
      }
    }
  };
  
  const token = await generateGuacamoleToken(tokenObj);
  window.open(`/autoconnect.html?token=${encodeURIComponent(token)}`, '_blank');
}
```

### Use Case 2: Backend API
```javascript
// Express.js endpoint
app.post('/api/rdp/connect', authenticateUser, async (req, res) => {
  const { serverId } = req.body;
  
  // Check user permissions
  if (!await userHasAccessToServer(req.user.id, serverId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const server = await db.servers.findById(serverId);
  const token = generateGuacamoleToken({
    connection: {
      type: "rdp",
      guacdHost: process.env.GUACD_HOST,
      guacdPort: parseInt(process.env.GUACD_PORT),
      settings: {
        hostname: server.hostname,
        username: server.username,
        password: decrypt(server.encryptedPassword),
        "ignore-cert": true,
        "security": "any"
      }
    }
  });
  
  res.json({ 
    url: `${process.env.GUACAMOLE_URL}/autoconnect.html?token=${encodeURIComponent(token)}` 
  });
});
```

### Use Case 3: Embedded iFrame
```html
<!-- Embed remote desktop directly in your page -->
<div id="remote-desktop-container">
  <iframe id="rdpFrame" width="100%" height="600px" frameborder="0"></iframe>
</div>

<script>
async function embedRemoteDesktop(hostname, username, password) {
  const tokenObj = {
    connection: {
      type: "rdp",
      guacdHost: "guacd-1",
      guacdPort: 4822,
      settings: {
        hostname, username, password,
        "ignore-cert": true,
        "security": "any"
      }
    }
  };
  
  const token = await generateGuacamoleToken(tokenObj);
  const url = `/autoconnect.html?token=${encodeURIComponent(token)}`;
  
  document.getElementById('rdpFrame').src = url;
}
</script>
```

## 🐛 Troubleshooting

### Token Generation Fails
- Ensure the encryption key is exactly 32 bytes
- Check that `crypto.subtle` is available (requires HTTPS or localhost)

### Connection Fails
- Verify the guacd instance is running and accessible
- Check that the remote server allows RDP/VNC connections
- Ensure credentials are correct

### Token Not Accepted
- Verify the encryption key matches on both client and server
- Check that the token is properly URL-encoded
- Ensure the token structure matches the expected format

## 📞 Support

For more detailed documentation, see:
- [TOKEN_USAGE.md](../guacamole-lite-client/html/TOKEN_USAGE.md) - Complete API documentation
- [autoconnect.html](../guacamole-lite-client/html/autoconnect.html) - Source code

## ⚖️ License

Use this example code freely in your projects. Modify as needed for your use case.
