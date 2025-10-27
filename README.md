# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

# Car Hub API - Strapi v5 Backend

API backend para o aplicativo Car Hub (React Native + Expo) usando Strapi v5 com MySQL.

## 🚀 Funcionalidades

- **Autenticação JWT** com registro e login de usuários
- **Gestão de carros** com CRUD completo e filtros avançados
- **Sistema de favoritos** para usuários logados
- **Sistema de mensagens** entre usuários (chat)
- **Upload de múltiplas imagens** para carros
- **Roles e permissões** configuradas automaticamente
- **CORS** configurado para Expo Development

## 📋 Pré-requisitos

- Node.js 18+ ou 20+
- MySQL 8.0+
- Yarn ou npm

## ⚙️ Instalação

### 1. Clone e instale dependências

```bash
cd car-hub-api
yarn install
```

### 2. Configure o banco de dados

**Opção A: Docker (Recomendado)**

```bash
# Inicie o MySQL via Docker
docker-compose up -d db

# Aguarde o MySQL inicializar (cerca de 30 segundos)
```

**Opção B: MySQL local**

1. Instale o MySQL localmente
2. Crie um banco de dados chamado `car_hub`
3. Ajuste as credenciais no arquivo `.env`

### 3. Execute as migrações e inicie o servidor

```bash
# Primeira execução - vai criar as tabelas automaticamente
yarn develop
```

### 4. Configure o admin

1. Acesse `http://localhost:1337/admin`
2. Crie sua conta de admin
3. As roles e permissões serão configuradas automaticamente via bootstrap

## 📖 Endpoints da API

### Autenticação

```http
POST /api/auth/local/register    # Registro de usuário
POST /api/auth/local            # Login
GET  /api/users/me              # Perfil do usuário logado
```

### Carros

```http
GET    /api/cars                # Lista carros (com filtros)
GET    /api/cars/:id            # Detalhes do carro
POST   /api/cars                # Criar carro (requer auth)
PUT    /api/cars/:id            # Atualizar carro (apenas dono)
DELETE /api/cars/:id            # Deletar carro (apenas dono)
```

### Favoritos

```http
GET    /api/favorites           # Lista favoritos do usuário
POST   /api/favorites           # Adicionar aos favoritos
DELETE /api/favorites/:id       # Remover dos favoritos
DELETE /api/favorites/by-car/:carId  # Remover por ID do carro
```

### Mensagens

```http
GET  /api/messages              # Lista mensagens do usuário
POST /api/messages              # Enviar mensagem
PUT  /api/messages/:id/mark-read # Marcar mensagem como lida
GET  /api/messages/conversations # Lista conversas agrupadas
```

## 🔐 Segurança e Permissões

### Roles configuradas automaticamente:

**Public (não logados):**
- Visualizar carros
- Fazer registro/login

**Authenticated (usuários logados):**
- CRUD completo em carros (apenas próprios para edição/exclusão)
- CRUD completo em favoritos (apenas próprios)
- Envio e recebimento de mensagens
- Upload e gerenciamento de arquivos

## 🐳 Docker

### Executar tudo via Docker

```bash
# Iniciar MySQL + Strapi
docker-compose up

# Executar apenas MySQL
docker-compose up -d db
```

## 📝 Scripts disponíveis

```bash
yarn develop    # Modo desenvolvimento com auto-reload
yarn start      # Modo produção
yarn build      # Build para produção
yarn strapi     # CLI do Strapi
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
