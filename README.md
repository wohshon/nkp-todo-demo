# Demo web app todo

## requires cnpg crd

In Nutanix Kubernetes Platform , you can use the provided cnpg helm chart which you can enabled from the management cluster

- kommander-cloudnative-pg

## build image, deploy to any k8s cluster

Update the `k8s/base/app.yaml` file with the image you build.

## Deploy with k8gb (multi-site demo)

Requires CNPG and k8gb installed on every cluster, with the k8gb DNS delegation in place.

```
k8s/base/                 the app (app.yaml) + its global names (gslb.yaml: aa / ap / geo)
k8s/overlays/lab-nkp1/    site 1: app + CNPG database + global names + database exposed for other sites
k8s/overlays/lab-nkp2/    site 2: app + global names, no database (uses nkp1's)
k8s/overlays/lab-nkp3/    optional site 3: same as site 2
k8s/overlays/lab-nkp3-app optional site 3 without global names (to add them live later)
```

The only per-environment values are in each overlay's `env.properties`
(hostnames, failover primary, and on site 1 the database's MetalLB IP).

```bash
kubectl apply -k k8s/overlays/lab-nkp1     # on nkp1
kubectl apply -k k8s/overlays/lab-nkp2     # on nkp2
```

The app reads its database settings from the secret `todo-db`, which is not stored
in Git. Create it with `app-db/db.sh` from the k8gb-nkp-demo kit
(`use-local` on nkp1, `expose` on nkp1, `use-remote` on nkp2); the app pod waits
until it exists.

Without k8gb (single cluster): `kubectl apply -f k8s/base/app.yaml`, then create
`todo-db` with `app-db/db.sh use-local`.
