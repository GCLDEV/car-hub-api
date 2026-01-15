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

# Stage de produção simplificado
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

# Instalar dependências de produção
RUN npm ci --omit=dev && npm cache clean --force

# Copiar todos os arquivos necessários
COPY --chown=strapi:nodejs . .

# Criar diretórios necessários e definir permissões corretas
RUN mkdir -p .tmp/data public/uploads && \
    chown -R strapi:nodejs .tmp public /app && \
    chmod -R 755 .tmp public && \
    chmod -R 777 .tmp

# Build da aplicação como root primeiro
RUN npm run build

# Mudar para usuário não-root
USER strapi

# Expor a porta da aplicação
EXPOSE 1337

# Definir variáveis de ambiente para produção
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=true

# Comando para iniciar a aplicação
CMD ["npm", "start"]