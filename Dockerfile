# Use a imagem oficial do Node.js 20 baseada no Alpine para menor tamanho
FROM node:20-alpine AS base

# Instalar dependências do sistema necessárias
RUN apk add --no-cache \
    build-base \
    sqlite \
    python3 \
    make \
    g++

# Definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração de dependências
COPY package*.json ./

# Stage de desenvolvimento
FROM base AS development
RUN npm install
COPY . .
EXPOSE 1337
CMD ["npm", "run", "develop"]

# Stage de build para produção
FROM base AS build
# Instalar dependências (incluindo devDependencies para o build)
RUN npm install

# Copiar código fonte
COPY . .

# Definir variáveis de ambiente para produção
ENV NODE_ENV=production

# Build da aplicação
RUN npm run build

# Stage de produção
FROM node:20-alpine AS production

# Instalar dependências do sistema necessárias apenas para produção
RUN apk add --no-cache \
    sqlite

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S strapi -u 1001

# Definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração de dependências
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev && npm cache clean --force

# Copiar a aplicação buildada do stage anterior
COPY --from=build --chown=strapi:nodejs /app/build ./build
COPY --from=build --chown=strapi:nodejs /app/public ./public
COPY --from=build --chown=strapi:nodejs /app/config ./config
COPY --from=build --chown=strapi:nodejs /app/database ./database
COPY --from=build --chown=strapi:nodejs /app/src ./src

# Criar diretórios necessários e definir permissões
RUN mkdir -p .tmp/data && \
    chown -R strapi:nodejs .tmp && \
    chmod -R 755 .tmp

# Mudar para usuário não-root
USER strapi

# Expor a porta da aplicação
EXPOSE 1337

# Definir variáveis de ambiente para produção
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=true

# Health check para verificar se a aplicação está funcionando
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1

# Comando para iniciar a aplicação
CMD ["npm", "start"]