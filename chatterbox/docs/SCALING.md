<!-- Purpose: Horizontal scaling and local worker design for ChatterBox v4.0.0. -->

# Scaling

ChatterBox defaults to a simple one-server Docker Compose topology. v4.0.0 adds a Redis Socket.io adapter hook and an optional Compose `scale` profile for local experiments.

## Redis Socket.io Adapter

Set:

```dotenv
SOCKET_IO_REDIS_ADAPTER=true
```

The server attempts to load the open-source `@socket.io/redis-adapter` package. If the package is not installed or Redis cannot provide a duplicate pub/sub client, startup continues with the default in-process adapter and records the adapter status.

The adapter lets Socket.io events fan out across multiple Node.js processes through Redis. Existing Redis presence/cache behavior remains separate.

## Local Scaling Profile

Default:

```bash
docker compose up --build
```

Optional local replica:

```bash
SOCKET_IO_REDIS_ADAPTER=true docker compose --profile scale up --build
```

The `server-replica` service does not publish a host port. A real multi-replica browser deployment still needs a reverse proxy/load balancer.

## Sticky Sessions

Socket.io can use long polling before WebSocket upgrade. Production multi-instance deployments should use sticky sessions at the load balancer, or force WebSocket-only traffic if the environment supports it.

## Background Workers

v4 uses local server-side worker modules:

- disappearing message cleanup
- expired status cleanup

Workers run inside the Node server process and require no paid scheduler. Multi-instance deployments should make cleanup idempotent or designate a single worker instance.

## Observability

The admin dashboard uses MongoDB counts/aggregations and Redis health state. `/api/admin/metrics` exposes a small Prometheus-compatible text response for local/open-source scraping. Grafana is not required.
