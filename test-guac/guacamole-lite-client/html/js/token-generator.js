async function generateGuacamoleToken(tokenObj, expirationMinutes = 15) {
  /* ------------ demo-only token generation (do this in backend IRL) --- */
  const CIPHER = 'AES-256-CBC';
  const KEY = new TextEncoder().encode('MySuperSecretKeyForParamsToken12');

  // Add expiration and issued-at timestamps
  const now = Date.now();
  const tokenWithExpiration = {
    ...tokenObj,
    exp: now + (expirationMinutes * 60 * 1000), // Expiration timestamp
    iat: now // Issued at timestamp
  };

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const algo = { name: "AES-CBC", iv };
  const key = await crypto.subtle.importKey("raw", KEY, algo, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt(algo, key,
    new TextEncoder().encode(JSON.stringify(tokenWithExpiration))));

  const token = btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    value: btoa(String.fromCharCode(...ct))
  }));

  return token;
} 
