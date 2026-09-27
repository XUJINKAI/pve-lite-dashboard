# PVE Lite Dashboard

[简体中文](README.md)

A lightweight Proxmox VE dashboard built with Vue and TypeScript. One page shows node and guest status and provides common VM/LXC power controls.

The dashboard discovers resources through the PVE API using the permissions of a dedicated API token. Caddy serves the static build and injects the token into same-origin API requests.

## Features

- Nodes, storage, physical disks, network interfaces, and the latest successful backup task.
- VM/LXC CPU, memory, IP addresses, disk usage, and network traffic.
- Start, shutdown, force stop, reboot, suspend, and resume controls, subject to permissions and guest state.
- Resource pool grouping, template grouping, collapsible details, and resource filters.
- Full guest configuration viewing and batch export to a TXT file.
- API permission matrix, Chinese and English interfaces, and responsive layouts.
- Browser-local settings and a built-in demo with fictional data.

## Try the demo

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/?data=mock`.

The demo includes eight guests covering running and stopped VMs and containers, a suspended VM, and a cloud template, plus storage, NVMe/SATA disks, multiple IP addresses, and an empty pool. Demo power actions affect the current page session; reloading restores the initial data.

With the default `auto` data source, GitHub Pages uses demo data. Other hosts use the live API. You can select the data source in Settings or use `?data=mock` / `?data=live`.

## How it works

```text
Browser → same-origin /api/api2/json/... → Caddy → PVE :8006
                                         injects API token
```

PVE supplies resource membership, permissions, and task results. Settings control presentation and are stored in the current browser's localStorage. The default foreground refresh interval is five seconds. Node details and backup history refresh every 60 seconds during resource polling; manual refresh also updates them.

## Build and deploy with Caddy

```bash
npm ci
npm run build
```

Deploy the contents of `dist/`, for example to `/srv/pve-lite-dashboard/dist`, and configure Caddy:

```caddy
pve-dashboard.example.com {
    root * /srv/pve-lite-dashboard/dist

    handle_path /api/* {
        reverse_proxy https://PVE_ADDRESS:8006 {
            header_up -Cookie
            header_up Authorization "PVEAPIToken={env.PVE_DASHBOARD_TOKEN}"
            transport http {
                tls_insecure_skip_verify
            }
        }
    }

    file_server
}
```

Replace the domain, deployment path, and PVE address. Supply `PVE_DASHBOARD_TOKEN` through the Caddy service environment:

```dotenv
PVE_DASHBOARD_TOKEN=dashboard@pve!dashboard=TOKEN_SECRET
```

`handle_path` removes `/api`, so PVE receives `/api2/json/...`. The certificate option accommodates a self-signed PVE certificate; remove it when Caddy trusts that certificate.

Anyone who can reach the API proxy can exercise the token's permissions. Restrict access to a trusted LAN, VPN, or an authenticated gateway, and give the token only the permissions needed. The token stays on the proxy server.

## Local development with PVE

Create `.env.local` in the project root:

```dotenv
PVE_DASHBOARD_URL=https://PVE_ADDRESS:8006
PVE_DASHBOARD_TOKEN=dashboard@pve!dashboard=TOKEN_SECRET
```

```bash
npm run dev
```

Open `http://127.0.0.1:4173/`. Vite proxies `/api/` and injects the token. Restart the development server after changing `.env.local`.

Development listens on localhost by default. For access from a trusted local network, explicitly run:

```bash
npm run dev -- --host 0.0.0.0
```

`.env.local` is ignored by Git. Production builds do not load the `PVE_DASHBOARD_` variables; configure the production proxy separately.

## PVE setup

1. In **Datacenter → Permissions → Users**, create a dedicated user, such as `dashboard@pve`.
2. In **Permissions → Roles**, create a role with `Sys.Audit`, `VM.Audit`, `Datastore.Audit`, and `Pool.Audit`. Add `VM.PowerMgmt` if power controls are needed.
3. Assign the role to the user at the desired scope. Assigning it at `/` with propagation covers the cluster; choose narrower VM or pool paths when appropriate.
4. In **Permissions → API Tokens**, create a token for that user. For this dedicated, permission-limited user, uncheck **Privilege Separation** so the token uses the user's permissions. Save the secret shown during creation.

The full token value is `USER@REALM!TOKEN_ID=TOKEN_SECRET`. The proxy adds the `PVEAPIToken=` prefix. With privilege separation enabled, configure token ACLs as well.

Some detail endpoints require additional permissions or an available guest agent. The page retains successful data and shows errors for failed auxiliary reads. QEMU filesystem usage depends on the guest agent; configured disk capacity provides a fallback.

### Resource pools

Create pools under **Datacenter → Permissions → Pools**, then add guests as members. The dashboard uses pool IDs as group titles and pool comments as descriptions. Guests without a pool appear in the unassigned group; templates appear in a separate group at the end.

## Settings and exports

Use the top-right Settings button to adjust refresh intervals, resource visibility, VMID exclusions, display fields, thresholds, and data source. Saved settings apply to the current browser. The import/export tab supports browser configuration JSON and guest configuration TXT downloads.

Guest configuration exports contain raw values and can include addresses, SSH public keys, Cloud-init credentials, and mount paths. Store these files privately and review them before sharing. Use demo data for public screenshots.

## Verification

```bash
npm run verify
```

Runs lint, TypeScript checks, unit tests, a production build, and Playwright interaction and visual regression tests. Install the Playwright Chromium browser if it is not available:

```bash
npx playwright install chromium
```

To run browser tests separately, build first:

```bash
npm run build
npm run test:e2e
```

Playwright uses the production preview server. Review expected visual changes before updating screenshot baselines with `npm run test:visual:update`.

Implementation and deployment details are documented in [Architecture](docs/ARCHITECTURE.md), [Design](docs/DESIGN.md), and [Installation](docs/INSTALL.md) (Chinese).
