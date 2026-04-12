# Cloudflare Tunnel Setup Guide

This guide explains how to set up and configure Cloudflare Tunnel to expose your local development environment (Frontend, API, and WebSockets) securely without using Ngrok. Cloudflare Tunnel ensures you have a permanent and secure HTTPS endpoint, which is especially important for features like mobile camera streaming.

---

## 1. Prerequisites

1. **A Cloudflare Account**: You need to have an active Cloudflare account.
2. **A Domain Name**: You must have a domain name managed by Cloudflare (DNS). If you don't have one, you can purchase one directly in Cloudflare.
3. **Cloudflared CLI**: The Cloudflare daemon must be installed on your local machine.

---

## 2. Installing Cloudflared

### Windows
Use Windows Package Manager (WinGet):
```powershell
winget install --id Cloudflare.cloudflared
```
*Alternatively, download the `.exe` directly from the [Cloudflare GitHub Releases](https://github.com/cloudflare/cloudflared/releases) and place it in your system PATH.*

### macOS (Homebrew)
```bash
brew install cloudflare/cloudflare/cloudflared
```

### Linux
```bash
curl -L 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64' -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

Verify installation:
```bash
cloudflared --version
```

---

## 3. Authenticate with Cloudflare

Run the following command to log in to your Cloudflare account. This command will open a browser window.
```bash
cloudflared tunnel login
```
* Select the domain you want to use for the tunnel. 
* Once authorized, Cloudflared will download a certificate file to your `.cloudflared` directory.

---

## 4. Create and Configure the Tunnel

1. **Create the Tunnel**: Give your tunnel a descriptive name (e.g., `anomaly-detection`).
```bash
cloudflared tunnel create anomaly-detection
```
*Note the **Tunnel ID** that is printed in the console output. You'll need it later.*

2. **Route Traffic**: Map a subdomain to your newly created tunnel. (e.g., `app.yourdomain.com`)
```bash
cloudflared tunnel route dns anomaly-detection app.yourdomain.com
```

3. **Create the Configuration File**: Navigate to your `.cloudflared` directory (usually `~/.cloudflared/` on Mac/Linux or `%USERPROFILE%\.cloudflared\` on Windows) and create a `config.yml` file.

Add the following configuration to `config.yml` (replace `<Tunnel-ID>` with your actual ID):

```yaml
tunnel: <Tunnel-ID>
credentials-file: /path/to/.cloudflared/<Tunnel-ID>.json

ingress:
  # Examples of splitting traffic if your project uses multiple ports.
  
  # Option A: Forward all traffic to the Vite Frontend (Port 5173 by default)
  # The frontend should proxy API and WS requests to the backend.
  - hostname: app.yourdomain.com
    service: http://localhost:5173

  # Option B: Specific routing (e.g., backend API on port 8000)
  # - hostname: api.yourdomain.com
    # service: http://localhost:8000

  # Catch-all rule (Required)
  - service: http_status:404
```

> **Note on Windows Paths**: If you are on Windows, your credentials file path should look like `C:\Users\YourUser\.cloudflared\<Tunnel-ID>.json`

---

## 5. Running the Tunnel

To start the tunnel and expose your local application, run:
```bash
cloudflared tunnel run anomaly-detection
```
You can now access your application securely via `https://app.yourdomain.com`.

---

## 6. Project Configuration Integration

Since this project uses a hybrid networking model (APIs/WebSockets via Cloudflare, high-bandwidth Video via local LAN), remember to update your `.env` files appropriately:

**Frontend (`.env`)**
```env
VITE_API_URL=https://app.yourdomain.com/api
VITE_WS_URL=wss://app.yourdomain.com/ws
# Keep the local network IP for direct video fetching
VITE_LOCAL_IP=http://192.168.X.X:8000 
```

**Backend (`.env`)**
If your backend requires knowledge of its external domain (for CORS or OAuth redirects):
```env
PUBLIC_URL=https://app.yourdomain.com
```

### Running as a Service (Optional)
If you want the tunnel to start automatically when your computer boots, you can install it as a service:
```bash
cloudflared service install
```
*(You may need to run your terminal as an Administrator / Root)*
