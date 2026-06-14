# Quantum V3 — Render Node.js

Servidor Node.js (Express) que replica o **método V3** da edge function `proxy-command`.
Encaminha o prompt direto para `POST https://api.lovable.dev/projects/{projeto_id}/chat`
com `intent: "fix_error"` e um `build_event_id` sintético (mesma lógica da edge function).

---

## 1. Deploy no Render

1. Crie um repositório Git com o conteúdo desta pasta (`render-v3/`) na raiz.
2. No Render: **New → Web Service** e aponte para o repo.
3. Configurações:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. (Opcional) Variáveis de ambiente em **Environment**:
   - `LOVABLE_API_URL` → `https://api.lovable.dev` (default)
   - `ALLOW_ORIGIN` → `*` (default — CORS)
   - `SHARED_SECRET` → string secreta. Se definida, **toda** requisição precisa enviar
     o header `x-shared-secret: <mesmo valor>`. Recomendado em produção.

Alternativamente, basta clicar **Deploy from blueprint** apontando para o `render.yaml`.

Após o deploy você terá uma URL tipo `https://quantum-v3.onrender.com`.

---

## 2. Endpoints

### `GET /health`
Healthcheck. Retorna `{ ok: true, service: "quantum-v3", t: ... }`.

### `POST /v3`
Encaminha o prompt para o Lovable usando o método V3.

#### Headers
| Header              | Obrigatório | Descrição |
|---------------------|-------------|-----------|
| `Content-Type`      | sim         | `application/json` |
| `Authorization`     | opcional*   | `Bearer <lovable_token>` (alternativa a passar `bearer_token` no body) |
| `x-shared-secret`   | se `SHARED_SECRET` estiver setado | Deve bater com a env var |

\* O token precisa chegar de algum jeito: ou no header `Authorization`, ou no body como `bearer_token`/`lovable_token`.

#### Body (JSON) — **mesmos parâmetros que a edge function `proxy-command` usa no ramo V3**

```json
{
  "projeto_id": "8f3a...-uuid-do-projeto-no-lovable",
  "mensagem": "Adicione um botão de logout no header",
  "bearer_token": "eyJhbGciOi...token_do_lovable",
  "chat_only": true,

  "files": [
    { "file_id": "file_...", "file_name": "screenshot.png" }
  ],
  "optimisticImageUrls": [
    "https://.../screenshot.png"
  ],

  "browser_session_id": "opcional",
  "viewport_width": 878,
  "viewport_height": 678,
  "viewport_dpr": 1.25
}
```

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `projeto_id` | string | — | UUID do projeto Lovable |
| `mensagem` | string | — | Prompt do usuário |
| `bearer_token` / `lovable_token` | string | — | Token Bearer do Lovable. Pode vir no header `Authorization` |
| `chat_only` | bool | `true` | Igual ao parâmetro da edge function |
| `files` | array | `[]` | Anexos no formato `{ file_id, file_name }` (use o pipeline V2 da própria edge function pra gerar) |
| `optimisticImageUrls` | string[] | `[]` | URLs preview de imagens |
| `browser_session_id` | string | — | Vira header `X-Browser-Session-ID` |
| `viewport_width/height/dpr` | number | 878/678/1.25 | Igual ao default da edge function |

#### Resposta — sucesso

```json
{
  "success": true,
  "message": "Prompt Enviado com Sucesso.",
  "method": "v3",
  "had_images": false,
  "message_id": "umsg_01h...",
  "ai_message_id": "aimsg_01h..."
}
```

#### Resposta — erro
```json
{ "success": false, "error_display": "...", "status": 401 }
```

(O status HTTP é sempre 200 — o `success: false` indica falha lógica, igual à edge function.)

---

## 3. Exemplo de requisição

### cURL
```bash
curl -X POST https://quantum-v3.onrender.com/v3 \
  -H "Content-Type: application/json" \
  -H "x-shared-secret: meu-segredo-opcional" \
  -d '{
    "projeto_id": "8f3a1c2e-9b00-4d11-8aaa-aaaaaaaaaaaa",
    "mensagem": "Crie uma landing page com hero, features e CTA",
    "bearer_token": "eyJhbGciOi...",
    "chat_only": true
  }'
```

### Node.js (fetch)
```js
const r = await fetch("https://quantum-v3.onrender.com/v3", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-shared-secret": process.env.SHARED_SECRET, // se configurou
  },
  body: JSON.stringify({
    projeto_id: "8f3a1c2e-9b00-4d11-8aaa-aaaaaaaaaaaa",
    mensagem: "Adicione dark mode",
    bearer_token: lovableToken,
    chat_only: true,
  }),
});
console.log(await r.json());
```

### JavaScript (browser/extensão)
```js
const res = await fetch("https://quantum-v3.onrender.com/v3", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    projeto_id,
    mensagem: prompt,
    bearer_token: lovableBearer,
    chat_only: true,
    files,                 // opcional — array {file_id, file_name}
    optimisticImageUrls,   // opcional
  }),
});
const json = await res.json();
if (!json.success) console.error(json.error_display);
```

---

## 4. Observações importantes

- **Uploads/anexos**: este servidor **não** faz o upload dos arquivos para o Lovable
  (esse pipeline é V2 — gera `file_id` via `/files/generate-upload-url`). Continue
  fazendo o upload onde já faz e mande aqui apenas o array `files` no formato
  `{ file_id, file_name }`. Se quiser que esse servidor também faça upload, peça
  e eu adiciono uma rota `POST /v3/upload`.
- **Sem licença/RLS**: este endpoint **não** valida licença nem grava `usage_tracking`
  (esse acoplamento é do Supabase). Use o `SHARED_SECRET` pra evitar uso público.
- **Compatível com a edge function**: o JSON enviado para o Lovable é byte-a-byte
  o mesmo do bloco `useV3` da `proxy-command`.
