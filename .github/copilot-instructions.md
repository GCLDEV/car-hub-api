# 🧠 Prompt Copilot – Strapi API for Car Marketplace (v5)

> ⚙️ **Objetivo:** Criar uma API backend com **Strapi v5** para integrar com o app **Car Marketplace (React Native + Expo)**.
> O backend deve seguir as melhores práticas de modelagem, segurança e organização, substituindo o mock API atual (`src/services/mockData.ts`).

---

## 🔧 Stack & Versão

* CMS: **Strapi v5 (latest)**
* Banco de dados: **MySQL**
* Autenticação: JWT (default Strapi)
* Upload de imagens: Strapi Upload Plugin (provider local)
* Deploy-ready para render.com ou Railway
* API consumida pelo app via **REST API** (não GraphQL)

---

## 📦 Estrutura de Conteúdo (Collections)

1. **User (Auth)**

   * username (string, required)
   * email (email, unique)
   * password (hashed)
   * avatar (media)
   * city (string)
   * state (string)

2. **Car**

   * title (string, required)
   * description (text)
   * price (integer, required)
   * year (integer)
   * brand (string)
   * model (string)
   * transmission (enum: manual | automatic)
   * fuel_type (enum: gasolina | etanol | flex | diesel | elétrico)
   * mileage (integer)
   * location (string)
   * images (media, multiple)
   * seller (relation: many-to-one → User)

3. **Favorites**

   * user (relation: many-to-one → User)
   * car (relation: many-to-one → Car)

4. **Messages (Chat)**

   * sender (relation: many-to-one → User)
   * receiver (relation: many-to-one → User)
   * content (text)
   * createdAt (datetime)

---

## 🚀 Boas Práticas de Configuração

* Habilitar **CORS** para o domínio do app Expo (`http://localhost:8081` e `exp://*`).
* Criar roles e permissions específicas:

  * `Public`: apenas leitura de listagens de carros.
  * `Authenticated`: pode criar/editar carros, favoritar, e enviar mensagens.
* Ativar `populate=*` apenas em endpoints controlados (não em todos).
* Validar inputs via **Strapi Validators** e políticas customizadas.
* Sanitizar resposta com `sanitizeOutput()` para não expor senhas ou campos privados.

---

## 🌐 Endpoints REST Esperados

**Cars**

```
GET /api/cars
GET /api/cars/:id
POST /api/cars  (auth required)
PUT /api/cars/:id  (owner only)
DELETE /api/cars/:id  (owner only)
```

**Favorites**

```
GET /api/favorites?populate=car
POST /api/favorites  { car: id }
DELETE /api/favorites/:id
```

**Auth**

```
POST /api/auth/local  (login)
POST /api/auth/local/register
GET /api/users/me
```

**Messages**

```
GET /api/messages?filters[receiver][id]=<id>&populate=sender
POST /api/messages
```

---

## 🧩 Padrões de Código (para controllers/services)

```js
// /src/api/car/controllers/car.js
const { sanitizeOutput } = require('@strapi/utils').sanitize;

module.exports = {
  async find(ctx) {
    const { query } = ctx;
    const entities = await strapi.db.query('api::car.car').findMany({
      ...query,
      populate: ['images', 'seller'],
    });
    return sanitizeOutput(entities, ctx);
  },
};
```

---

## 🔐 Segurança

* Desativar upload anônimo.
* Limitar tamanho de upload (máx. 10MB).
* Sanitizar `description` e `content` com HTML sanitizer.
* Rate-limit auth endpoints.

---

## 📱 Integração com o App (React Native)

API endpoints serão consumidos via `src/services/api/`:

```ts
// src/services/api/cars.ts
import { api } from './client'

export async function getCarsList(filters?: unknown) {
  const res = await api.get('/cars', { params: filters })
  return res.data.data
}
```

```ts
// src/services/api/client.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: 'https://your-strapi-api-url/api',
  headers: { 'Content-Type': 'application/json' }
})
```

---

## ✅ Checklist do Copilot

Quando gerar código Strapi:

* [ ] Usar `async function` para controladores e services
* [ ] Nunca usar `any`
* [ ] Manter tipagem clara dos schemas
* [ ] Sempre incluir `populate` nos relacionamentos
* [ ] Respeitar roles & permissions
* [ ] Gerar controladores REST limpos (sem lógica no route file)
* [ ] Implementar políticas de ownership nos PUT/DELETE

---

## 🧩 Extra (Copilot pode sugerir)

* Endpoint de busca com filtros (`price_min`, `price_max`, `brand`, `fuel_type`)
* Endpoint de upload de múltiplas imagens para `Car`
* Webhook para notificar vendedor quando alguém favoritar seu carro
* Contador de views em cada `Car`

---

## 🔧 Observações de Deploy & MySQL

* Para produção, configurar variáveis de ambiente do MySQL (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`).
* Usar **migrations** e backups regulares.
* Se for usar Docker, providenciar um `docker-compose.yml` com serviço `db` (MySQL) e `strapi`.

---

Se quiser, eu posso agora:

* Gerar o `docker-compose.yml` com MySQL + Strapi v5;
* Gerar exemplos de controllers/services/validators para as collections;
* Adicionar comandos passo-a-passo para bootstrap (create project, install, config DB, run).

Diga qual desses você quer que eu gere em seguida e eu crio aqui mesmo.
