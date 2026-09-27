# PVE Lite Dashboard

[简体中文](README.md)

A lightweight Proxmox VE dashboard without a backend. A single page displays node and VM status and provides VM power management.

Once the API token and address are configured, the dashboard automatically discovers the nodes and virtual machines it has permission to access and displays their status.

Features:

- Physical infrastructure: node information, storage information, physical disks, network lists, and recent backups
- Virtual machines: CPU, memory, IP addresses, disk usage, network traffic, and more
- Power management buttons for virtual machines with the required permissions, supporting start, stop, pause, resume, and more
- View VM configurations or export a summary of all VM configurations through Settings
- View a table of the current API token's permissions

## How it works

```text
Browser → same-origin /api/api2/json/... → Caddy → PVE :8006
                                         injects API token
```

The page sends requests to the local `/api` path. The server injects the PVE token and forwards the API requests to the PVE address.

## Build and deploy with Caddy

Install dependencies and generate the static files:

```bash
npm ci
npm run build
```

Build output is placed in `dist/`. Assuming the deployment path is `/srv/pve-lite-dashboard/dist`, configure Caddy as follows:

```caddy
pve.domain {
    root * /srv/pve-lite-dashboard/dist

    handle_path /api/* {
        reverse_proxy https://PVE_ADDRESS:8006 {
            header_up Authorization "PVEAPIToken=PVE_TOKEN"
            transport http {
                tls_insecure_skip_verify
            }
        }
    }

    file_server
}
```

Replace the site domain, `dist` path, PVE_ADDRESS, and PVE_TOKEN to match your environment.

`handle_path` removes the `/api` prefix, so when the page requests `/api/api2/json/cluster/resources`, PVE receives `/api2/json/cluster/resources`. The example uses `tls_insecure_skip_verify` for PVE's default self-signed certificate; if Caddy already trusts the PVE certificate, you can remove this configuration.

## Local development

Create `.env.local` in the project root:

```dotenv
PVE_DASHBOARD_URL=https://PVE_ADDRESS:8006
PVE_DASHBOARD_TOKEN=PVE_TOKEN
```

Then run:

```bash
npm run dev
```

## PVE setup

### PVE_TOKEN

1. In the PVE web interface, open **Datacenter → Permissions → Users**, click **Add**, and create a dedicated user. For example, use `dashboard` as the username and `Proxmox VE authentication server` as the realm to create `dashboard@pve`.
2. Open **Datacenter → Permissions** and add a user permission: select `dashboard@pve` as the user and the built-in `PVEAuditor` role. To monitor the entire cluster, select `/` as the path and enable **Propagate**.
3. For power management, create `DashboardPower` under **Permissions → Roles**, selecting only `VM.PowerMgmt`; then assign this role to `dashboard@pve`.
4. Open **Datacenter → Permissions → API Tokens**, click **Add**, select `dashboard@pve` as the user, enter `dashboard` as the token ID, uncheck **Privilege Separation**, and click **Add**. Save the secret shown only once in the dialog.

The resulting PVE_TOKEN has the following format:

```text
dashboard@pve!dashboard=TOKEN_SECRET
```

Set this value in the Caddy service environment or as `PVE_DASHBOARD_TOKEN` for local development.

### VM grouping

VM/LXC groups in Lite Dashboard correspond to PVE **Resource Pools**:

1. In the PVE web interface, open **Datacenter → Permissions → Pools** and click **Create**.
2. Enter a pool ID, such as `development`, and a description in the comment field, such as `Development environment`, then save.
3. Select the newly created pool in the resource tree on the left, open **Members**, click **Add**, and select the VMs or containers to include in the group.
4. Return to Lite Dashboard and refresh the page to see the result.

Guests that do not belong to a resource pool appear in the **Unassigned resource pool** group. Templates appear in a separate **Templates** group.

### Security

This project does not provide access control. Anyone who can access the dashboard can exercise all permissions granted to the API token. Use it in a secure environment and keep the API token's permissions to the minimum required.

## License

This project is licensed under the [MIT License](LICENSE).
