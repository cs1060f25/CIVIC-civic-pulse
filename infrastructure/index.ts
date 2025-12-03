import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";

// Get configuration
// Provider-scoped GCP config lives under the "gcp" namespace (keys like "gcp:project").
const gcpConfig = new pulumi.Config("gcp");
const project = gcpConfig.require("project");
const region = gcpConfig.get("region") || gcp.config.region || "us-central1";
// Use a zonal cluster so that initialNodeCount corresponds to the total node count (not per-zone).
const zone = gcpConfig.get("zone") || `${region}-a`;

// App-specific config lives under the "civicpulse" namespace (keys like "civicpulse:googleClientId").
const appConfigNs = new pulumi.Config("civicpulse");
const clusterName = appConfigNs.get("gkeClusterName") || "civicpulse-cluster";
// Base image registry path (no project concatenation here). For example:
// - Artifact Registry: us-central1-docker.pkg.dev/civic-pulse-480006/civicpulse
// - (Legacy) GCR: gcr.io/civic-pulse-480006
const imageRegistryBase =
    appConfigNs.get("imageRegistry") ||
    `us-central1-docker.pkg.dev/${project}/civicpulse`;
const googleClientId = appConfigNs.require("googleClientId");
const googleApiKeySecret = appConfigNs.get("googleApiKeySecret") || "google-api-key";

// Create or use a dedicated network and subnetwork for the cluster.
// Some projects don't have the legacy "default" network, so we manage our own.
const network = new gcp.compute.Network("civicpulse-network", {
    autoCreateSubnetworks: false,
});

const subnetwork = new gcp.compute.Subnetwork("civicpulse-subnetwork", {
    region,
    ipCidrRange: "10.0.0.0/20",
    network: network.id,
});

// Create GKE cluster with 1 node and 16GB memory
// Using e2-standard-4: 4 vCPU, 16GB RAM
const cluster = new gcp.container.Cluster(clusterName, {
    name: clusterName,
    // Zonal cluster: this ensures initialNodeCount is the total number of nodes.
    location: zone,
    initialNodeCount: 1,
    nodeConfig: {
        // Use a custom machine type with 4 vCPU and 12GB RAM.
        // GCP custom e2 layout: e2-custom-<vCPU>-<memoryMB>
        // 12GB = 12288MB
        machineType: "e2-custom-4-12288",
        diskSizeGb: 50,
        diskType: "pd-standard",
        oauthScopes: [
            "https://www.googleapis.com/auth/compute",
            "https://www.googleapis.com/auth/devstorage.read_write",
            "https://www.googleapis.com/auth/logging.write",
            "https://www.googleapis.com/auth/monitoring",
        ],
    },
    deletionProtection: false,
    enableLegacyAbac: false,
    network: network.name,
    subnetwork: subnetwork.name,
});

// Build kubeconfig manually because the classic kubeconfigRaw helper was removed
const clusterKubeconfig = pulumi
    .all([cluster.name, cluster.endpoint, cluster.masterAuth])
    .apply(([name, endpoint, masterAuth]) => {
        const context = `${project}_${region}_${name}`;
        return `
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    exec:
      apiVersion: "client.authentication.k8s.io/v1beta1"
      command: "gke-gcloud-auth-plugin"
      provideClusterInfo: true
`;
    });

// Create Kubernetes provider
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: clusterKubeconfig,
});

// Create namespace
const namespace = new k8s.core.v1.Namespace(
    "civicpulse",
    {},
    { provider: k8sProvider }
);

const namespaceName = namespace.metadata.name;

// Create persistent volumes for shared backend data
// Note: Using ReadWriteOnce for GKE standard storage. For ReadWriteMany, use NFS or similar.
const backendDbPvc = new k8s.core.v1.PersistentVolumeClaim(
    "backend-db",
    {
        metadata: {
            name: "backend-db",
            namespace: namespaceName,
        },
        spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "standard-rwo",
            resources: {
                requests: {
                    storage: "10Gi",
                },
            },
        },
    },
    { provider: k8sProvider }
);

const backendDataPvc = new k8s.core.v1.PersistentVolumeClaim(
    "backend-data",
    {
        metadata: {
            name: "backend-data",
            namespace: namespaceName,
        },
        spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "standard-rwo",
            resources: {
                requests: {
                    storage: "50Gi",
                },
            },
        },
    },
    { provider: k8sProvider }
);

const backendProcessingPvc = new k8s.core.v1.PersistentVolumeClaim(
    "backend-processing",
    {
        metadata: {
            name: "backend-processing",
            namespace: namespaceName,
        },
        spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "standard-rwo",
            resources: {
                requests: {
                    storage: "20Gi",
                },
            },
        },
    },
    { provider: k8sProvider }
);

// Create ConfigMap for shared configuration
const appConfig = new k8s.core.v1.ConfigMap(
    "app-config",
    {
        metadata: {
            name: "app-config",
            namespace: namespaceName,
        },
        data: {
            CIVICPULSE_DB_PATH: "/app/backend/db/civicpulse.db",
            PYTHONUNBUFFERED: "1",
            NODE_ENV: "production",
        },
    },
    { provider: k8sProvider }
);

// Create Secret for Google API key (if needed)
const googleApiKeySecretResource = new k8s.core.v1.Secret(
    "google-api-key",
    {
        metadata: {
            name: googleApiKeySecret,
            namespace: namespaceName,
        },
        type: "Opaque",
        // Note: Set actual secret value via Pulumi config or external secret management
        // stringData: {
        //     "google_api_key.txt": config.requireSecret("googleApiKey"),
        // },
    },
    { provider: k8sProvider }
);

// Frontend Deployment
// Use commit SHA from environment if available (for CI/CD), otherwise use 'latest'
const frontendImageTag = process.env.GITHUB_SHA || process.env.IMAGE_TAG || "latest";
const frontendImage = `${imageRegistryBase}/civicpulse-frontend:${frontendImageTag}`;
const frontendDeployment = new k8s.apps.v1.Deployment(
    "frontend",
    {
        metadata: {
            name: "frontend",
            namespace: namespaceName,
            labels: {
                app: "frontend",
            },
        },
        spec: {
            replicas: 2,
            selector: {
                matchLabels: {
                    app: "frontend",
                },
            },
            template: {
                metadata: {
                    labels: {
                        app: "frontend",
                    },
                },
                spec: {
                    initContainers: [
                        {
                            name: "fix-db-permissions",
                            image: "busybox:latest",
                            command: [
                                "sh",
                                "-c",
                                "chmod 777 /app/backend/db && chmod 666 /app/backend/db/civicpulse.db 2>/dev/null || true",
                            ],
                            volumeMounts: [
                                {
                                    name: "backend-db",
                                    mountPath: "/app/backend/db",
                                },
                            ],
                        },
                    ],
                    containers: [
                        {
                            name: "frontend",
                            image: frontendImage,
                            ports: [
                                {
                                    containerPort: 3000,
                                    name: "http",
                                },
                            ],
                            env: [
                                {
                                    name: "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
                                    value: googleClientId,
                                },
                                {
                                    name: "CIVICPULSE_DB_PATH",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "CIVICPULSE_DB_PATH",
                                        },
                                    },
                                },
                                {
                                    name: "NODE_ENV",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "NODE_ENV",
                                        },
                                    },
                                },
                            ],
                            volumeMounts: [
                                {
                                    name: "backend-db",
                                    mountPath: "/app/backend/db",
                                    // Read-write access needed for user authentication (users table)
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "512Mi",
                                    cpu: "250m",
                                },
                                limits: {
                                    memory: "1Gi",
                                    cpu: "500m",
                                },
                            },
                        },
                    ],
                    volumes: [
                        {
                            name: "backend-db",
                            persistentVolumeClaim: {
                                claimName: backendDbPvc.metadata.name,
                            },
                        },
                    ],
                },
            },
        },
    },
    { provider: k8sProvider }
);

// Frontend Service (ClusterIP for Ingress)
// Using replaceOnChanges to handle LoadBalancer -> ClusterIP transition
const frontendService = new k8s.core.v1.Service(
    "frontend",
    {
        metadata: {
            name: "frontend",
            namespace: namespaceName,
            labels: {
                app: "frontend",
            },
        },
        spec: {
            type: "ClusterIP",
            ports: [
                {
                    port: 80,
                    targetPort: 3000,
                    protocol: "TCP",
                    name: "http",
                },
            ],
            selector: {
                app: "frontend",
            },
        },
    },
    { 
        provider: k8sProvider,
        replaceOnChanges: ["spec.type"],
    }
);

// Managed SSL Certificate for civicpulse.dev (Kubernetes resource)
const sslCertificate = new k8s.apiextensions.CustomResource(
    "civicpulse-ssl",
    {
        apiVersion: "networking.gke.io/v1",
        kind: "ManagedCertificate",
        metadata: {
            name: "civicpulse-dev-ssl",
            namespace: namespaceName,
        },
        spec: {
            domains: ["civicpulse.dev", "www.civicpulse.dev"],
        },
    },
    { provider: k8sProvider }
);

// GKE Ingress with HTTPS
const frontendIngress = new k8s.networking.v1.Ingress(
    "frontend",
    {
        metadata: {
            name: "frontend",
            namespace: namespaceName,
            annotations: {
                "networking.gke.io/managed-certificates": sslCertificate.metadata.name,
                "kubernetes.io/ingress.class": "gce",
                "kubernetes.io/ingress.allow-http": "true",
            },
        },
        spec: {
            rules: [
                {
                    host: "civicpulse.dev",
                    http: {
                        paths: [
                            {
                                path: "/",
                                pathType: "Prefix",
                                backend: {
                                    service: {
                                        name: frontendService.metadata.name,
                                        port: {
                                            number: 80,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                {
                    host: "www.civicpulse.dev",
                    http: {
                        paths: [
                            {
                                path: "/",
                                pathType: "Prefix",
                                backend: {
                                    service: {
                                        name: frontendService.metadata.name,
                                        port: {
                                            number: 80,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        },
    },
    { provider: k8sProvider }
);

// Ingestion Deployment
const ingestionImageTag = process.env.GITHUB_SHA || process.env.IMAGE_TAG || "latest";
const ingestionImage = `${imageRegistryBase}/civicpulse-ingestion:${ingestionImageTag}`;
const ingestionDeployment = new k8s.apps.v1.Deployment(
    "ingestion",
    {
        metadata: {
            name: "ingestion",
            namespace: namespaceName,
            labels: {
                app: "ingestion",
            },
        },
        spec: {
            // Temporarily disable lm-parser in this environment until GOOGLE_API_KEY is configured
            replicas: 0,
            selector: {
                matchLabels: {
                    app: "ingestion",
                },
            },
            template: {
                metadata: {
                    labels: {
                        app: "ingestion",
                    },
                },
                spec: {
                    containers: [
                        {
                            name: "ingestion",
                            image: ingestionImage,
                            env: [
                                {
                                    name: "PYTHONUNBUFFERED",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "PYTHONUNBUFFERED",
                                        },
                                    },
                                },
                            ],
                            volumeMounts: [
                                {
                                    name: "backend-data",
                                    mountPath: "/app/backend/data",
                                },
                                {
                                    name: "backend-db",
                                    mountPath: "/app/backend/db",
                                    readOnly: true,
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "256Mi",
                                    cpu: "100m",
                                },
                                limits: {
                                    memory: "512Mi",
                                    cpu: "500m",
                                },
                            },
                        },
                    ],
                    volumes: [
                        {
                            name: "backend-data",
                            persistentVolumeClaim: {
                                claimName: backendDataPvc.metadata.name,
                            },
                        },
                        {
                            name: "backend-db",
                            persistentVolumeClaim: {
                                claimName: backendDbPvc.metadata.name,
                            },
                        },
                    ],
                },
            },
        },
    },
    { provider: k8sProvider }
);

// Processing Deployment
const processingImageTag = process.env.GITHUB_SHA || process.env.IMAGE_TAG || "latest";
const processingImage = `${imageRegistryBase}/civicpulse-processing:${processingImageTag}`;
const processingDeployment = new k8s.apps.v1.Deployment(
    "processing",
    {
        metadata: {
            name: "processing",
            namespace: namespaceName,
            labels: {
                app: "processing",
            },
        },
        spec: {
            // Temporarily disable ingestion in this environment
            replicas: 0,
            selector: {
                matchLabels: {
                    app: "processing",
                },
            },
            template: {
                metadata: {
                    labels: {
                        app: "processing",
                    },
                },
                spec: {
                    containers: [
                        {
                            name: "processing",
                            image: processingImage,
                            env: [
                                {
                                    name: "PYTHONUNBUFFERED",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "PYTHONUNBUFFERED",
                                        },
                                    },
                                },
                            ],
                            volumeMounts: [
                                {
                                    name: "backend-processing",
                                    mountPath: "/app/backend/processing",
                                },
                                {
                                    name: "backend-data",
                                    mountPath: "/app/backend/data",
                                },
                                {
                                    name: "backend-db",
                                    mountPath: "/app/backend/db",
                                    readOnly: true,
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "512Mi",
                                    cpu: "250m",
                                },
                                limits: {
                                    memory: "2Gi",
                                    cpu: "1000m",
                                },
                            },
                        },
                    ],
                    volumes: [
                        {
                            name: "backend-processing",
                            persistentVolumeClaim: {
                                claimName: backendProcessingPvc.metadata.name,
                            },
                        },
                        {
                            name: "backend-data",
                            persistentVolumeClaim: {
                                claimName: backendDataPvc.metadata.name,
                            },
                        },
                        {
                            name: "backend-db",
                            persistentVolumeClaim: {
                                claimName: backendDbPvc.metadata.name,
                            },
                        },
                    ],
                },
            },
        },
    },
    { provider: k8sProvider }
);

// LM Parser Deployment
const lmParserImageTag = process.env.GITHUB_SHA || process.env.IMAGE_TAG || "latest";
const lmParserImage = `${imageRegistryBase}/civicpulse-lm-parser:${lmParserImageTag}`;
const lmParserDeployment = new k8s.apps.v1.Deployment(
    "lm-parser",
    {
        metadata: {
            name: "lm-parser",
            namespace: namespaceName,
            labels: {
                app: "lm-parser",
            },
        },
        spec: {
            // Temporarily disable processing in this environment
            replicas: 0,
            selector: {
                matchLabels: {
                    app: "lm-parser",
                },
            },
            template: {
                metadata: {
                    labels: {
                        app: "lm-parser",
                    },
                },
                spec: {
                    containers: [
                        {
                            name: "lm-parser",
                            image: lmParserImage,
                            env: [
                                {
                                    name: "PYTHONUNBUFFERED",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "PYTHONUNBUFFERED",
                                        },
                                    },
                                },
                                {
                                    name: "CIVICPULSE_DB_PATH",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: appConfig.metadata.name,
                                            key: "CIVICPULSE_DB_PATH",
                                        },
                                    },
                                },
                                {
                                    name: "GOOGLE_API_KEY_PATH",
                                    value: "/run/secrets/google_api_key.txt",
                                },
                            ],
                            volumeMounts: [
                                {
                                    name: "backend-processing",
                                    mountPath: "/app/backend/processing",
                                },
                                {
                                    name: "backend-data",
                                    mountPath: "/app/backend/data",
                                },
                                {
                                    name: "backend-db",
                                    mountPath: "/app/backend/db",
                                },
                                {
                                    name: "google-api-key",
                                    mountPath: "/run/secrets/google_api_key.txt",
                                    readOnly: true,
                                    subPath: "google_api_key.txt",
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "1Gi",
                                    cpu: "500m",
                                },
                                limits: {
                                    memory: "4Gi",
                                    cpu: "2000m",
                                },
                            },
                        },
                    ],
                    volumes: [
                        {
                            name: "backend-processing",
                            persistentVolumeClaim: {
                                claimName: backendProcessingPvc.metadata.name,
                            },
                        },
                        {
                            name: "backend-data",
                            persistentVolumeClaim: {
                                claimName: backendDataPvc.metadata.name,
                            },
                        },
                        {
                            name: "backend-db",
                            persistentVolumeClaim: {
                                claimName: backendDbPvc.metadata.name,
                            },
                        },
                        {
                            name: "google-api-key",
                            secret: {
                                secretName: googleApiKeySecretResource.metadata.name,
                            },
                        },
                    ],
                },
            },
        },
    },
    { provider: k8sProvider }
);

// Export important values
export const frontendUrl = pulumi.interpolate`https://civicpulse.dev`;
export const frontendIngressIp = frontendIngress.status.apply(
    (status) => status.loadBalancer?.ingress?.[0]?.ip || "pending"
);
export const sslCertificateName = sslCertificate.metadata.name;
export const namespaceNameOutput = namespaceName;
export const clusterEndpoint = cluster.endpoint;
export const clusterNameOutput = cluster.name;

