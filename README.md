# Quantum Public API — Render Server

Servidor Node.js (Express) para hospedar no [Render](https://render.com). Expõe uma API HTTP simples para **envio de prompts** ao projeto Lovable, **sem qualquer espera ou atraso entre envios**.

A autenticação interna já vem embutida no servidor — o cliente **não** precisa enviar licença.

---

## Endpoints

| Método | Rota      | Descrição                          |
| ------ | --------- | ---------------------------------- |
| GET    | `/health` | Healthcheck (`{ ok: true, ... }`). |
| POST   | `/send`   | Envia um prompt.                   |

---

## Variáveis de ambiente (todas opcionais)

| Variável          | Default              | Descrição                                                                  |
| ----------------- | -------------------- | -------------------------------------------------------------------------- |
| `PORT`            | Injetado pelo Render | Porta HTTP.                                                                |
| `ALLOW_ORIGIN`    | `*`                  | Origem permitida no CORS.                                                  |
| `SHARED_SECRET`   | *(vazio)*            | Se definido, exige o header `x-shared-secret` igual a ele em toda chamada. |
| `REQUEST_TIMEOUT` | `60000`              | Timeout da requisição em milissegundos.                                    |

---

## Deploy no Render

1. Suba `server.js`, `package.json` e `render.yaml` num repositório.
2. No Render: **New → Web Service** → aponte para o repo.
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. (Opcional) configure `SHARED_SECRET` em *Environment*.

Rodando local:

```bash
cd render-public-api
npm install
npm start
# -> quantum-public-api listening on :10000
```

---

## POST `/send`

### Headers

| Header            | Obrigatório | Descrição                                      |
| ----------------- | ----------- | ---------------------------------------------- |
| `Content-Type`    | Sim         | `application/json`                             |
| `x-shared-secret` | Condicional | Apenas se `SHARED_SECRET` estiver configurado. |

### Body (JSON)

| Campo           | Tipo    | Obrigatório | Descrição                                                    |
| --------------- | ------- | ----------- | ------------------------------------------------------------ |
| `projeto_id`    | string  | Sim         | ID do projeto Lovable de destino.                            |
| `token_lovable` | string  | Sim         | Token da sessão Lovable (JWT). Aceita também `bearer_token`. |
| `mensagem`      | string  | Sim         | Texto do prompt (1 a 50.000 caracteres).                     |
| `modo_pensar`   | boolean | Não         | `true` = modo plano (sem editar código). Padrão `false`.     |

### Exemplo cURL

```bash
curl -X POST https://SEU-SERVICO.onrender.com/send \
  -H "Content-Type: application/json" \
  -d '{
    "projeto_id": "00000000-0000-0000-0000-000000000000",
    "token_lovable": "eyJhbGciOi...partes.do.jwt",
    "mensagem": "Crie um botão azul no topo da página",
    "modo_pensar": false
  }'
```

### Exemplo JavaScript

```js
const res = await fetch("https://SEU-SERVICO.onrender.com/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    projeto_id: "uuid-do-projeto",
    token_lovable: "jwt.do.lovable",
    mensagem: "Adicione dark mode",
    modo_pensar: false,
  }),
});
const data = await res.json();
```

### Exemplo Python

```python
import requests

r = requests.post(
    "https://SEU-SERVICO.onrender.com/send",
    json={
        "projeto_id": "uuid-do-projeto",
        "token_lovable": "jwt.do.lovable",
        "mensagem": "Refatore o componente Header",
        "modo_pensar": False,
    },
    timeout=60,
)
print(r.json())
```

---

## Respostas

### Sucesso (HTTP 200)

```json
{
  "success": true,
  "message": "Comando Processado com Sucesso Via Rede Oculta!"
}
```

### Falha (HTTP 200)

```json
{
  "success": false,
  "error_display": "Falha ao conectar a rede oculta!",
  "message": "Falha ao conectar a rede oculta!"
}
```

### Erros de validação

| HTTP | `error_display`          | Causa                        |
| ---- | ------------------------ | ---------------------------- |
| 400  | `projeto_id obrigatório` | Campo ausente.               |
| 400  | `token obrigatório`      | Campo ausente.               |
| 400  | `mensagem obrigatória`   | Campo vazio.                 |
| 400  | `Token Lovable inválido` | JWT malformado.              |
| 401  | `unauthorized`           | `x-shared-secret` incorreto. |

---

## Observações

- **Sem atraso entre envios:** não há janela de espera; cada chamada é processada imediatamente.
- Os detalhes internos de processamento nunca são retornados ao cliente — apenas as mensagens de sucesso ou falha acima.
