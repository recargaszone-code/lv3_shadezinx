# Quantum V3 — Render Server

Servidor Node.js (Express) para hospedar no [Render](https://render.com) que replica o **método V3** do Quantum Lovable: envia o prompt direto para `POST https://api.lovable.dev/projects/{projeto_id}/chat` usando o intent `fix_error` com um `build_event_id` sintético.

**Novidade nesta versão:** o body aceita o campo **`model`** para escolher qual modelo a Lovable vai usar ao processar o prompt.

---

## Endpoints

| Método | Rota      | Descrição                                                   |
| ------ | --------- | ----------------------------------------------------------- |
| GET    | `/health` | Healthcheck (`{ ok: true, ... }`).                          |
| GET    | `/models` | Lista os aliases suportados no campo `model`.               |
| POST   | `/v3`     | Envia um prompt para o projeto Lovable no método V3.        |

---

## Variáveis de ambiente

| Variável          | Default                     | Descrição                                                                        |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `PORT`            | Injetado pelo Render        | Porta HTTP.                                                                      |
| `LOVABLE_API_URL` | `https://api.lovable.dev`   | URL base da API Lovable.                                                         |
| `ALLOW_ORIGIN`    | `*`                         | Origem permitida no CORS.                                                        |
| `SHARED_SECRET`   | *(vazio)*                   | Se definido, todas as requisições precisam enviar `x-shared-secret` igual a ele. |

---

## Deploy no Render

1. Faça upload dos arquivos `server.js` e `package.json` num repositório.
2. No Render: **New → Web Service** → aponte para o repo.
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. (Opcional) Configure `SHARED_SECRET` em *Environment*.

Rodando local:

```bash
cd render-v3
npm install
npm start
# -> quantum-v3 listening on :10000
```

---

## Campo `model` — como usar

O campo `model` no body da requisição escolhe qual modelo a Lovable usa ao processar o prompt. Ele aceita **aliases amigáveis** (case-insensitive) ou o **id "cru"** do modelo.

### Aliases suportados

| Alias amigável       | Id enviado para a Lovable |
| -------------------- | ------------------------- |
| `GPT5-CODEX`         | `gpt-5-codex`             |
| `CLAUDE-Opus 4.8`    | `claude-opus-4-8`         |
| `Gemini 3.1`         | `gemini-3.1-pro`          |

Também aceitos: `codex`, `opus 4.8`, `opus-4.8`, `gemini-3.1`, além dos ids crus (`gpt-5-codex`, `claude-opus-4-8`, `gemini-3.1-pro`).

Se você mandar qualquer outra string, ela é enviada **exatamente como veio** para o campo `model` da Lovable (útil para modelos novos que ainda não estão mapeados).

Se `model` for **omitido / `null`**, o servidor envia `model: null` no payload — a Lovable usa o default do projeto.

> Os ids da direita são o que a Lovable espera hoje no campo `model`. Se em algum momento a Lovable renomear o id de um modelo, basta ajustar o mapa `MODEL_ALIASES` no topo de `server.js`.

---

## Body do `POST /v3`

```jsonc
{
  "projeto_id": "550e8400-e29b-41d4-a716-446655440000",   // obrigatório
  "mensagem":   "Refatore o header pra usar flex e adicione um menu mobile.", // obrigatório
  "bearer_token": "eyJhbGciOi...",   // Token do Lovable (ou header Authorization: Bearer ...)

  "model": "GPT5-CODEX",             // opcional — alias ou id cru

  "chat_only": true,                 // opcional (default true)
  "files": [],                       // opcional — anexos no shape do /chat
  "optimisticImageUrls": [],         // opcional

  "browser_session_id": "abc-123",   // opcional
  "viewport_width":  878,            // opcional
  "viewport_height": 678,            // opcional
  "viewport_dpr":    1.25            // opcional
}
```

### Resposta de sucesso

```json
{
  "success": true,
  "message": "Prompt Enviado com Sucesso.",
  "method": "v3",
  "model": "gpt-5-codex",
  "had_images": false,
  "message_id":   "umsg_...",
  "ai_message_id":"aimsg_..."
}
```

### Resposta de erro

```json
{
  "success": false,
  "error_display": "mensagem obrigatória",
  "status": 400
}
```

---

## Exemplos

### cURL — GPT5-CODEX

```bash
curl -X POST https://SEU-APP.onrender.com/v3 \
  -H "Content-Type: application/json" \
  -H "x-shared-secret: SEU_SEGREDO" \
  -d '{
    "projeto_id":  "550e8400-e29b-41d4-a716-446655440000",
    "mensagem":    "Adiciona dark mode global.",
    "bearer_token":"eyJhbGciOi...",
    "model":       "GPT5-CODEX"
  }'
```

### cURL — CLAUDE-Opus 4.8

```bash
curl -X POST https://SEU-APP.onrender.com/v3 \
  -H "Content-Type: application/json" \
  -d '{
    "projeto_id":  "550e8400-e29b-41d4-a716-446655440000",
    "mensagem":    "Explique a arquitetura do projeto.",
    "bearer_token":"eyJhbGciOi...",
    "model":       "CLAUDE-Opus 4.8"
  }'
```

### cURL — Gemini 3.1

```bash
curl -X POST https://SEU-APP.onrender.com/v3 \
  -H "Content-Type: application/json" \
  -d '{
    "projeto_id":  "550e8400-e29b-41d4-a716-446655440000",
    "mensagem":    "Cria uma landing page nova.",
    "bearer_token":"eyJhbGciOi...",
    "model":       "Gemini 3.1"
  }'
```

### JavaScript (fetch)

```js
const r = await fetch("https://SEU-APP.onrender.com/v3", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-shared-secret": "SEU_SEGREDO", // se você configurou
  },
  body: JSON.stringify({
    projeto_id: PROJETO_ID,
    mensagem: "Adiciona um formulário de contato",
    bearer_token: LOVABLE_TOKEN,
    model: "GPT5-CODEX", // ou "CLAUDE-Opus 4.8" ou "Gemini 3.1"
  }),
});
const data = await r.json();
console.log(data);
```

---

## Segurança

- **`SHARED_SECRET`**: recomendado em produção. Sem ele, qualquer pessoa com a URL do Render pode disparar prompts para qualquer projeto Lovable (desde que tenha o Bearer do usuário).
- O `bearer_token` do Lovable é sensível — nunca logue nem exponha em frontend público.
- CORS: por padrão `*`. Restrinja com `ALLOW_ORIGIN` para o domínio da sua extensão/site.

---

## Erros comuns

| Status | `error_display`                      | Causa                                                                   |
| ------ | ------------------------------------ | ----------------------------------------------------------------------- |
| 400    | `projeto_id obrigatório`             | Falta o campo `projeto_id`.                                             |
| 400    | `bearer_token obrigatório`           | Falta o token do Lovable (body ou header `Authorization`).              |
| 400    | `mensagem obrigatória`               | Prompt vazio.                                                           |
| 401    | `unauthorized`                       | `SHARED_SECRET` está definido e o header `x-shared-secret` não bate.    |
| 200    | `success:false` + `status` upstream  | A Lovable rejeitou o prompt (token inválido/expirado, projeto sem acesso, modelo indisponível na conta, etc.). |

---

## Estrutura

```
render-v3/
├── server.js       # servidor Express + método V3 + resolver de model
├── package.json    # deps (express, cors) e script `start`
└── README.md       # este arquivo
```
