// ============================================================
// Quantum Public API — Render Node.js server
// ============================================================
// Endpoint HTTP simples para envio de prompts.
// Tudo já vem configurado (hardcoded): o cliente só precisa mandar
// projeto_id, token_lovable e mensagem.
//
//   POST /send      -> envia um prompt
//   GET  /health    -> healthcheck
//
// Variáveis de ambiente (todas opcionais):
//   PORT              (injetada pelo Render)
//   ALLOW_ORIGIN      CORS (default "*")
//   SHARED_SECRET     se definido, exige header x-shared-secret
//   REQUEST_TIMEOUT   ms (default 60000)
// ============================================================

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: process.env.ALLOW_ORIGIN || "*" }));
app.use(express.json({ limit: "25mb" }));

// ---- Configuração interna (hardcoded) ----
const UPSTREAM_URL =
  "https://shcsggilkdjjxvorcida.supabase.co/functions/v1/chama-public-api";
const UPSTREAM_KEY = "sb_publishable_1tGR4OuIzxhKfbLy8fD88Q_SN2RTRSN";
const LICENSE_KEY = "QL-1497A46F0FD54C47BEDAB495";

const SHARED_SECRET = process.env.SHARED_SECRET || "";
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 60000);

const OK_MSG = "Comando Processado com Sucesso Via Rede Oculta!";
const FAIL_MSG = "Falha ao conectar a rede oculta!";

function ok(res, extra = {}) {
  return res.json({ success: true, message: OK_MSG, ...extra });
}
function failed(res, detail) {
  if (detail) console.error("[public-api] fail:", String(detail).slice(0, 500));
  return res.json({ success: false, error_display: FAIL_MSG, message: FAIL_MSG });
}

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "quantum-public-api", t: Date.now() })
);

app.post("/send", async (req, res) => {
  try {
    if (SHARED_SECRET && (req.header("x-shared-secret") || "") !== SHARED_SECRET) {
      return res.status(401).json({ success: false, error_display: "unauthorized" });
    }

    const {
      projeto_id,
      mensagem,
      modo_pensar = false,
      bearer_token,
      token_lovable,
      files,
    } = req.body || {};

    const token = String(
      token_lovable ||
        bearer_token ||
        (req.header("authorization") || "").replace(/^Bearer\s+/i, "")
    ).trim();

    const attachments = Array.isArray(files) ? files.slice(0, 10) : [];

    if (!projeto_id) {
      return res.status(400).json({ success: false, error_display: "projeto_id obrigatório" });
    }
    if (!token) {
      return res.status(400).json({ success: false, error_display: "token obrigatório" });
    }
    if ((typeof mensagem !== "string" || !mensagem.trim()) && attachments.length === 0) {
      return res.status(400).json({ success: false, error_display: "mensagem obrigatória" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let upstream;
    try {
      upstream = await fetch(UPSTREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: UPSTREAM_KEY,
          Authorization: `Bearer ${UPSTREAM_KEY}`,
          "x-license-key": LICENSE_KEY,
        },
        body: JSON.stringify({
          license_key: LICENSE_KEY,
          projeto_id: String(projeto_id),
          token_lovable: token,
          mensagem: typeof mensagem === "string" ? mensagem : "",
          modo_pensar: !!modo_pensar,
          files: attachments,
        }),

        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await upstream.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    if (upstream.ok && data && data.success === true) {
      return ok(res);
    }

    // Erros de validação de entrada voltam para o cliente sem detalhes internos.
    if (upstream.status === 400) {
      return res.status(400).json({
        success: false,
        error_display: data.error_display || "Requisição inválida",
      });
    }

    return failed(res, raw);
  } catch (err) {
    return failed(res, err && err.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`quantum-public-api listening on :${PORT}`));
