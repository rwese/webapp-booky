# Log Aggregation Configuration for Booky Backend

# File: backend/LOGGING.md

## Overview

This document describes the logging configuration for the Booky backend, including structured JSON logging, log aggregation setup, and best practices for production environments.

## Log Format

The backend uses structured JSON logging for all application logs:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "booky-backend",
  "environment": "production",
  "requestId": "req-abc123",
  "userId": "user-456",
  "method": "GET",
  "route": "/api/books",
  "statusCode": 200,
  "duration": 150,
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1"
}
```

### Log Levels

| Level     | Description            | Use Case                               |
| --------- | ---------------------- | -------------------------------------- |
| `error`   | Errors and exceptions  | Production issues, crashes             |
| `warn`    | Warning conditions     | Potential issues, degraded performance |
| `info`    | Informational messages | Request/response logging, operations   |
| `debug`   | Debug information      | Troubleshooting, development           |
| `verbose` | Detailed trace         | Deep debugging, performance analysis   |

## Application Logging

### Environment Configuration

```env
# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_PRETTY=false

# Request logging
LOG_REQUESTS=true
LOG_REQUEST_BODY=false  # Set to true for debugging only
LOG_REQUEST_ID=true

# Sensitive fields to redact
LOG_REDACT_FIELDS=password,token,secret,key,authorization
```

### Structured Logger Implementation

```typescript
// backend/src/logger.ts
import winston from "winston"
import crypto from "crypto"

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "service"],
  }),
  winston.format.json()
)

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : ""
    return `${timestamp} [${level}]: ${message} ${metaStr}`
  })
)

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.LOG_PRETTY === "true" ? prettyFormat : logFormat,
  defaultMeta: {
    service: "booky-backend",
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  },
  transports: [
    // Console output
    new winston.transports.Console({
      silent: process.env.NODE_ENV === "test",
    }),
  ],
})

// Request ID middleware
export function addRequestId(req: any, res: any, next: any) {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID()
  res.setHeader("X-Request-ID", req.requestId)
  next()
}

// Request logging middleware
export function logRequest(req: any, res: any, next: any) {
  const startTime = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - startTime
    const logData = {
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get("user-agent"),
      ip: req.ip || req.connection.remoteAddress,
    }

    if (res.statusCode >= 400) {
      logger.warn("Request failed", logData)
    } else {
      logger.info("Request completed", logData)
    }
  })

  next()
}

// Sensitive field redaction
export function redactSensitiveData(data: any): any {
  const redactFields = (process.env.LOG_REDACT_FIELDS || "").split(",")

  function redact(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(redact)
    }

    if (obj && typeof obj === "object") {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (
          redactFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase())
          )
        ) {
          result[key] = "[REDACTED]"
        } else {
          result[key] = redact(value)
        }
      }
      return result
    }

    return obj
  }

  return redact(data)
}
```

## Nginx Logging

### Nginx Configuration

```nginx
# Log format with request ID
log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                '$status $body_bytes_sent "$http_referer" '
                '"$http_user_agent" "$http_x_forwarded_for" '
                'rt=$request_time uct=$upstream_connect_time '
                'uht=$upstream_header_time urt=$upstream_response_time '
                'uid=$http_x_request_id';

# Access log
access_log /var/log/nginx/access.log main;

# Error log
error_log /var/log/nginx/error.log warn;
```

## Log Aggregation Setup

### Option 1: ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
# docker-compose.logging.yml
version: "3.8"

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
      - ./logstash/config:/usr/share/logstash/config:ro
    ports:
      - "5000:5000"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch-data:
```

### Option 2: Loki + Grafana

```yaml
# docker-compose.loki.yml
version: "3.8"

services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki:/etc/loki

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - ./promtail:/etc/promtail
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yaml
    depends_on:
      - loki

  grafana:
    image: grafana/grafana:10.2.0
    environment:
      - GF_PATHS_PROVISIONING=/etc/grafana/provisioning
      - GF_PATHS_DATA=/var/lib/grafana
      - GF_PATHS_LOGS=/var/log/grafana
    ports:
      - "3000:3000"
    volumes:
      - ./grafana:/etc/grafana/provisioning
    depends_on:
      - loki
```

### Log Shipper Configuration (Fluent Bit)

```yaml
# fluent-bit.conf
[SERVICE]
    Flush         5
    Log_Level     info
    Daemon        off
    Parsers_File  parsers.conf

[INPUT]
    Name              tail
    Path              /var/log/booky/*.log
    Parser            json
    Tag               booky.*
    Refresh_Interval  5
    Mem_Buf_Limit     50MB

[FILTER]
    Name                kubernetes
    Match               booky.*
    Kube_URL            https://kubernetes.default.svc:443
    Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
    Merge_Log           On
    Merge_Log_Key       log_processed
    K8S-Logging.Parser  On
    K8S-Logging.Exclude Off

[OUTPUT]
    Name            loki
    Match           *
    Host            loki
    Port            3100
    Labels          job=booky,environment=$ENVIRONMENT
    Auto_Kubernetes_Labels On
```

## Log Analysis

### Useful Kibana/Loki Queries

#### Error Logs

```
level:error
```

#### Slow Requests (>500ms)

```
duration > 0.5 AND level:info
```

#### Authentication Failures

```
route:/api/auth/* AND statusCode:401
```

#### Rate Limit Events

```
route:* AND error:rate_limit_exceeded
```

#### User Activity

```
userId:user-456
```

## Log Retention

| Log Type    | Retention | Storage |
| ----------- | --------- | ------- |
| Application | 30 days   | Hot     |
| Application | 1 year    | Cold    |
| Audit       | 2 years   | Cold    |
| Access      | 90 days   | Hot     |
| Error       | 1 year    | Cold    |

## Alerting Rules

### Critical Alerts

```yaml
# prometheus/rules/booky-alerts.yml
groups:
  - name: booky-logs
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(errors_total[5m])) by (type)
          > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate exceeded 0.1 errors/second"

      - alert: SlowResponses
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
          > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response times"
          description: "P95 latency exceeded 1 second"
```

## Best Practices

1. **Use Structured Logging**: Always use JSON format for parsing
2. **Include Request IDs**: Trace requests across services
3. **Redact Sensitive Data**: Never log passwords, tokens, or keys
4. **Use Appropriate Log Levels**: Don't log everything at info level
5. **Monitor Log Volume**: Watch for unexpected spikes
6. **Set Up Retention Policies**: Prevent disk overflow
7. **Use Correlation IDs**: Track requests across microservices
8. **Centralize Logs**: Aggregate in one place for analysis

## Troubleshooting

### Check Application Logs

```bash
# View recent logs
tail -f /var/log/booky/app.log

# Search for errors
grep "error" /var/log/booky/app.log

# Filter by request ID
grep "req-abc123" /var/log/booky/app.log
```

### Check Nginx Logs

```bash
# View access log
tail -f /var/log/nginx/access.log

# Search for 5xx errors
awk '$9 ~ /5[0-9][0-9]/' /var/log/nginx/access.log

# Slow requests
awk '$NF > 1' /var/log/nginx/access.log
```
