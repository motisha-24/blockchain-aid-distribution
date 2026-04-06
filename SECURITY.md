# Security Configuration Guide

This document outlines the security measures implemented in the AidChain API and how to configure them properly.

## Environment Variables Required

Copy `flask_api/.env.example` to `flask_api/.env` and configure the following:

### JWT Configuration
```bash
JWT_SECRET=your-super-secure-jwt-secret-key-here-32-chars-minimum
JWT_ALGORITHM=HS256
JWT_EXP_DELTA_SECONDS=1800  # 30 minutes
```

### Cache Encryption
```bash
CACHE_SECRET=your-super-secure-cache-encryption-key-here-32-chars-minimum
```

### Blockchain Configuration (Choose ONE)

#### Option 1: Local Development (Recommended)
```bash
MODE=LOCAL
LOCAL_RPC=http://127.0.0.1:7545
LOCAL_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
LOCAL_AID_ADDRESS=0x0000000000000000000000000000000000000000
LOCAL_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
```

#### Option 2: Sepolia Testnet (Production)
```bash
MODE=CLOUD
INFURA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_REAL_API_KEY
PRIVATE_KEY=your_real_private_key_without_0x_prefix
CLOUD_REGISTRY_ADDRESS=0x4F2279c15c829b3b7892DfCB88Dbd195B46E5e6
CLOUD_AID_ADDRESS=0xb6e120A02b06Fc250F7dDD13777714d22e50ab7A
```

## Security Features Implemented

### 1. JWT Authentication with Expiry
- Tokens expire after 30 minutes by default
- No default fallback secret - must be configured
- Logout adds tokens to persistent revocation list

### 2. CORS Protection
- Only allows requests from specified origins:
  - `http://localhost:3000` (development)
  - `http://127.0.0.1:3000` (development)
  - `https://your-dashboard-domain.com` (production - update this!)

### 3. Password Security
- Uses bcrypt with salt for password hashing
- No longer uses weak SHA-256
- Each password gets unique salt

### 4. Rate Limiting
- Login: 5 attempts per minute
- User creation: 10 per minute
- Beneficiary registration: 10 per minute
- Aid distribution: 15 per minute

### 5. Cache Encryption
- Offline transaction cache uses AES-256 encryption
- Key derived from environment variable, not hardcoded
- Protects sensitive transaction data at rest

### 6. Input Validation
- All API inputs validated for type, length, and format
- SQL injection prevented through parameterized queries
- National ID format validation

## Setup Instructions

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cd flask_api
   cp .env.example .env
   # Edit .env with secure values
   ```

3. **Generate secure secrets:**
   ```bash
   python -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"
   python -c "import secrets; print('CACHE_SECRET=' + secrets.token_hex(32))"
   ```

4. **Choose blockchain mode:**
   - **Local Development:** Set `MODE=LOCAL` and start Ganache/Truffle
   - **Sepolia Testnet:** Set `MODE=CLOUD` with real API key and private key

5. **Start the server:**
   ```bash
   python app.py
   ```

### Local Development Setup
For local development, you'll need to run a local blockchain:

```bash
# Install Ganache globally (if not already installed)
npm install -g ganache-cli

# Or use Truffle's built-in Ganache
truffle develop

# In another terminal, start the API
cd flask_api
python app.py
```

## Security Best Practices

- **Never commit .env files** to version control
- **Use strong, unique secrets** for JWT and cache encryption
- **Update CORS origins** for production deployment
- **Run behind HTTPS** in production
- **Regularly rotate JWT secrets**
- **Monitor rate limiting logs** for abuse patterns
- **Backup revoked_tokens.json** securely

## Migration Notes

If upgrading from previous version:
- Existing SHA-256 password hashes will not work - users must reset passwords
- Configure JWT_SECRET and CACHE_SECRET before starting
- Update CORS origins for your deployment

## Testing Security

To verify security measures are working:

1. **Test CORS:** Try calling API from unauthorized origin
2. **Test rate limits:** Attempt multiple rapid logins
3. **Test JWT expiry:** Wait 30+ minutes with active session
4. **Test logout:** Verify token becomes invalid after logout