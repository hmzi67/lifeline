# Docker Setup for Lifeline Application

This guide explains how to deploy the Lifeline application using Docker.

## 🚀 Quick Start

### 1. Prerequisites
- Docker installed on your VPS
- Docker Compose installed
- Ports 3000, 5173 and 5174 free on the host's loopback interface (they are published on 127.0.0.1 only)

### 2. Build and Start Services

```bash
# Clone the repository (if not already done)
git clone https://github.com/your-repo/lifeline-frontend.git
cd lifeline-frontend

# Create the compose file and its secrets (both are git-ignored)
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env            # set POSTGRES_PASSWORD and a matching DATABASE_URL
cp api/.env.example api/.env    # JWT, Stripe, email and OAuth settings

# Build and start all services
docker compose up -d --build
```

### 3. Access Services
Ports are bound to `127.0.0.1`, so they are reachable from the server itself and from
its TLS reverse proxy, not from the internet:
- **Client**: `http://127.0.0.1:5173`
- **Admin**: `http://127.0.0.1:5174`
- **API**: `http://127.0.0.1:3000` (for the proxy serving the mobile app's API hostname)
- **PostgreSQL**: not published; see "Access PostgreSQL" below

## 📁 Project Structure

```
lifeline-frontend/
├── api/                  # Node.js API service
│   ├── Dockerfile        # API Dockerfile
│   └── ...
├── client/               # React client application
│   ├── Dockerfile        # Client Dockerfile
│   └── ...
├── admin/                # React admin panel
│   ├── Dockerfile        # Admin Dockerfile
│   └── ...
├── docker-compose.example.yml  # Template for the (untracked) docker-compose.yml
├── .env.example          # Compose secrets template (POSTGRES_*, DATABASE_URL)
└── .dockerignore         # Files to ignore in Docker builds
```

## 🐳 Services

### PostgreSQL
- **Image**: `postgres:15-alpine`
- **Port**: none published (internal network only)
- **Database / user**: `POSTGRES_DB` / `POSTGRES_USER` from `.env` (default `lifeline`)
- **Password**: `POSTGRES_PASSWORD` from `.env`; compose will not start without it
- **Volume**: postgres_data (persistent storage)

### API Service
- **Build**: Node.js 18
- **Port**: 3000
- **Environment**: All API environment variables
- **Volumes**: 
  - `./api/uploads` for file uploads
  - `./api/logs` for application logs
- **Depends on**: PostgreSQL

### Client Service
- **Build**: Vite + Nginx
- **Port**: 127.0.0.1:5173
- **API**: same-origin `/api`, proxied by the container's nginx to the api service
- **Nginx**: Serves static files with SPA routing

### Admin Service
- **Build**: Vite + Nginx
- **Port**: 127.0.0.1:5174
- **API**: same-origin `/api`, proxied by the container's nginx to the api service
- **Nginx**: Serves static files with SPA routing

## 🔧 Configuration

### Environment Variables

No secrets live in the compose file. Compose reads `POSTGRES_*`, `DATABASE_URL` and
`VITE_STRIPE_PUBLISHABLE_KEY` from `.env` (template: `.env.example`), and the API reads the
rest from `api/.env` (template: `api/.env.example`). Both files are git-ignored.

### Custom Domains

To use custom domains, update the `nginx.conf` files in both `client/` and `admin/` directories:

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Change this
    # ... rest of config
}
```

## 🛠️ Common Commands

### Build and start services
```bash
docker-compose up -d --build
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f
```

### View specific service logs
```bash
docker-compose logs -f api
```

### Rebuild specific service
```bash
docker-compose build api
docker-compose up -d api
```

### Run database migrations
```bash
docker-compose exec api npm run migrate
```

### Access PostgreSQL
```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## 📦 Deployment Checklist

- [ ] Install Docker and Docker Compose on VPS
- [ ] Clone repository
- [ ] Copy docker-compose.example.yml to docker-compose.yml and fill in .env and api/.env
- [ ] Build and start services
- [ ] Run database migrations
- [ ] Set up reverse proxy (Nginx/Apache) for domains
- [ ] Configure SSL certificates
- [ ] Test all services

## 🔒 Security Notes

1. **Database Credentials**: Set a long random `POSTGRES_PASSWORD` in `.env`; there is no default
2. **API Secrets**: Update JWT secrets, Stripe keys, etc.
3. **CORS**: Update CORS origins for production domains
4. **SSL**: Use HTTPS in production with reverse proxy

## 🚀 Production Deployment

For production deployment:

1. **Use a reverse proxy** (Nginx, Traefik) for SSL termination
2. **Set up proper domains** and DNS records
3. **Configure HTTPS** with Let's Encrypt
4. **Monitor services** with Docker logging and monitoring tools

## 📝 Notes

- The client and admin services use Nginx to serve static files
- API service connects to PostgreSQL using Docker internal networking
- All services are on the same `lifeline_network` for internal communication
- PostgreSQL data is persisted using Docker volumes