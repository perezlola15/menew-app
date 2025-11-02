FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye

# [Optional] Uncomment this section to install additional OS packages.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends xdg-utils

RUN apt-get update && apt-get install -y curl && \
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# [Optional] Uncomment if you want to install an additional version of node using nvm
ARG EXTRA_NODE_VERSION=20
# Instalar la versión de Node.js especificada y configurarla como predeterminada
RUN su node -c "source /usr/local/share/nvm/nvm.sh && \
    nvm install ${EXTRA_NODE_VERSION} && \
    nvm alias default ${EXTRA_NODE_VERSION} && \
    nvm use ${EXTRA_NODE_VERSION} && \
    nvm alias stable ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node modules
RUN su node -c "npm install -g @shopify/cli@latest"
