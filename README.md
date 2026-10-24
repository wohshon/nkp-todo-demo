# Demo web app todo

## requires cnpg crd

In Nutanix Kubernetes Platform , you can use the provided cnpg helm chart which you can enabled from the management cluster

- kommander-cloudnative-pg

## build image, deploy to any k8s cluster

Update the `k8s/base/app.yaml` file with the image you build.

## Deploy with k8gb (multi-site demo)

Requires CNPG and k8gb installed on every cluster, with the k8gb DNS delegation in place.
The full step-by-step guide is the k8gb-nkp-demo runbook (branch `env/lab`).

```
k8s/base/                the app (app.yaml) + its global names (gslb.yaml)
k8s/overlays/site1       site 1: app + CNPG database + aa/ap + database exposed for other sites
k8s/overlays/site2       site 2: app + its own CNPG instance + aa/ap (app uses site 1's database)
k8s/overlays/site3       site 3: app + aa/ap, no database (uses site 1's)
k8s/overlays/siteN-app   the same without Gslbs: before k8gb is installed, or to add a site later
k8s/addons/geo           the geo global name; apply on every site once GeoIP is on in k8gb
```

The only per-environment value is the database IP in `k8s/overlays/site1/env.properties`
(the k8gb kit writes it from `~/lab.env`). The app reads its database settings from the
secret `todo-db`, created by `app-db/db.sh` in the k8gb kit.
