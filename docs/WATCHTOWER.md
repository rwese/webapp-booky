# Watchtower Auto-Update Configuration

## Overview

Watchtower is a container-based tool that automatically monitors your Docker containers and updates them when new images are pushed to the container registry. This guide explains how to configure Watchtower for the webapp-booky deployment on your NAS.

## Features

- **Auto-updates**: Automatically pulls and deploys new images when available
- **Rolling updates**: Updates one service at a time to minimize downtime
- **Cleanup**: Removes old images after successful updates
- **HTTP API**: Manual trigger support via REST API
- **Security**: Token-based authentication for HTTP API

## Prerequisites

1. Docker and Docker Compose installed on your NAS
2. GitHub Container Registry (GHCR) access configured
3. Existing webapp-booky deployment (see [NAS Deployment](NAS_DEPLOYMENT.md))

## Quick Start

### 1. Deploy Watchtower

```bash
# Copy Watchtower compose file to NAS
scp docker-compose.watchtower.sh user@nas-ip:/volume1/webapps/booky/

# SSH into NAS
ssh user@nas-ip
cd /volume1/webapps/booky

# Deploy Watchtower (run in same directory as docker-compose.production.yml)
docker-compose -f docker-compose.watchtower.yml up -d
```

### 2. Configure API Token

**Important**: Change the default API token for security:

```bash
# Edit the environment file
nano docker/.env.production
```

Add or update:

```bash
WATCHTOWER_API_TOKEN=your-secure-random-token
```

### 3. Deploy Update Script

```bash
# Copy update script to NAS
scp scripts/update-nas.sh user@nas-ip:/volume1/webapps/booky/

# SSH into NAS
ssh user@nas-ip
cd /volume1/webapps/booky
chmod +x scripts/update-nas.sh
```

## Usage

### Automatic Updates

Watchtower runs continuously and checks for updates every 5 minutes by default. When a new image is pushed to GHCR, Watchtower will:

1. Pull the new image
2. Stop the old container
3. Start the new container
4. Remove the old image (cleanup enabled)

### Manual Update Trigger

To manually trigger an update check:

```bash
./scripts/update-nas.sh --apply
```

### Check Status

```bash
./scripts/update-nas.sh --status
```

### View Logs

```bash
./scripts/update-nas.sh --logs
```

### View Recent Activity

```bash
./scripts/update-nas.sh --activity
```

## Configuration Options

### Polling Interval

Change how often Watchtower checks for updates:

```yaml
# In docker-compose.watchtower.yml
environment:
  - WATCHTOWER_POLL_INTERVAL=300 # 5 minutes (default)
  # - WATCHTOWER_POLL_INTERVAL=900  # 15 minutes
  # - WATCHTOWER_POLL_INTERVAL=3600 # 1 hour
```

### Update Schedule

Use cron expressions for scheduled updates:

```yaml
environment:
  - WATCHTOWER_SCHEDULE=0 0 3 * * * # Every day at 3 AM
```

### Notification Hooks

Configure notifications for update events:

```yaml
environment:
  # Slack
  - WATCHTOWER_SLACK_HOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
  - WATCHTOWER_SLACK_CHANNEL=#deployments
  - WATCHTOWER_SLACK_USERNAME=watchtower

  # Discord
  - WATCHTOWER_DISCORD_HOOK_URL=https://discord.com/api/webhooks/xxx/xxx

  # Email (via SMTP)
  - WATCHTOWER_SMTP_HOST=smtp.example.com
  - WATCHTOWER_SMTP_PORT=587
  - WATCHTOWER_SMTP_USER=user@example.com
  - WATCHTOWER_SMTP_PASSWORD=password
  - WATCHTOWER_NOTIFICATION_EMAIL_FROM=watchtower@example.com
  - WATCHTOWER_NOTIFICATION_EMAIL_TO=admin@example.com
```

### Label-Based Filtering

Watchtower uses labels to identify which containers to monitor:

```yaml
services:
  frontend:
    image: ghcr.io/rwese/webapp-booky/frontend:latest
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

## Security

### API Authentication

The HTTP API requires a bearer token for authentication:

```bash
# Set token via environment variable
export WATCHTOWER_API_TOKEN=your-secure-token

# Trigger update
curl -X POST -H "Authorization: Bearer $WATCHTOWER_API_TOKEN" \
  http://localhost:8080/v1/update
```

### Network Security

By default, Watchtower's HTTP API listens on all interfaces. To restrict access:

```yaml
environment:
  # Only listen on localhost
  - WATCHTOWER_HTTP_API_LISTEN=127.0.0.1:8080
```

For remote access, consider using a reverse proxy with TLS.

## Rollback

If an update causes issues, you can rollback:

### Manual Rollback

```bash
# View previous images
docker images ghcr.io/rwese/webapp-booky/*

# Stop current containers
docker-compose -f docker-compose.production.yml down

# Manually pull and run previous version
docker pull ghcr.io/rwese/webapp-booky/frontend:v1.0.0
docker pull ghcr.io/rwese/webapp-booky/backend:v1.0.0

# Restart with specific version
IMAGE_TAG=v1.0.0 docker-compose -f docker-compose.production.yml up -d
```

### Automatic Rollback

Watchtower doesn't support automatic rollback, but you can:

1. Check logs: `./scripts/update-nas.sh --logs`
2. Identify the issue
3. Use the existing backup system from `deploy-nas.sh`

## Troubleshooting

### Watchtower Not Running

```bash
# Check container status
docker ps | grep watchtower

# View errors
docker logs booky-watchtower

# Restart Watchtower
docker-compose -f docker-compose.watchtower.yml restart
```

### Updates Not Triggering

1. Check Watchtower logs for errors
2. Verify GHCR authentication (may need `docker login ghcr.io`)
3. Ensure containers have the correct labels
4. Check network connectivity to GHCR

### Out of Disk Space

Watchtower cleanup is enabled by default. To force cleanup:

```bash
# Manual cleanup
docker system prune -a

# Check disk usage
docker system df
```

## File Structure

```
/volume1/webapps/booky/
├── docker-compose.production.yml   # Main application
├── docker-compose.watchtower.yml   # Watchtower configuration
├── docker/
│   └── .env.production             # Environment configuration
├── scripts/
│   ├── deploy-nas.sh               # Deployment script
│   ├── setup-nas.sh                # Setup script
│   └── update-nas.sh               # Update trigger script
└── docs/
    └── WATCHTOWER.md               # This file
```

## Integration with Existing Deployment

If you already have the existing deployment scripts, Watchtower complements them:

| Component       | Purpose                         |
| --------------- | ------------------------------- |
| `deploy-nas.sh` | Initial deployment and rollback |
| `update-nas.sh` | Manual Watchtower triggers      |
| Watchtower      | Automatic updates from GHCR     |

## Best Practices

1. **Test updates in staging** before pushing to production
2. **Monitor logs** after updates: `./scripts/update-nas.sh --logs`
3. **Keep backups**: Use `deploy-nas.sh rollback` if needed
4. **Secure API**: Use a strong token and restrict network access
5. **Notifications**: Enable Slack/Discord notifications for visibility

## API Reference

### Endpoints

| Method | Endpoint      | Description            |
| ------ | ------------- | ---------------------- |
| POST   | `/v1/update`  | Trigger update check   |
| GET    | `/v1/version` | Get Watchtower version |
| GET    | `/v1/monitor` | Monitor containers     |

### Example: Trigger Update

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/v1/update
```

Response:

```json
{
  "Message": "Update triggered",
  "Status": "ok"
}
```
