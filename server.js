// ============================================================
// Quantum V3 — Render Node.js server
// ============================================================
// Replica o "método V3" da edge function `proxy-command`:
// envia o prompt direto para  POST  https://api.lovable.dev/projects/{projeto_id}/chat
// usando o intent "fix_error" com um build_event_id sintético.
//
// Endpoint exposto:   POST /v3
// Healthcheck:        GET  /health
//
// Variáveis de ambiente opcionais:
//   PORT                 (Render injeta automaticamente)
//   LOVABLE_API_URL      default: https://api.lovable.dev
//   ALLOW_ORIGIN         default: *           (CORS)
//   SHARED_SECRET        default: <vazio>     (se definido, exige header
//                                              x-shared-secret igual)
// ============================================================

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: process.env.ALLOW_ORIGIN || "*" }));
app.use(express.json({ limit: "25mb" }));

const LOVABLE_API_URL = process.env.LOVABLE_API_URL || "https://api.lovable.dev";
const SHARED_SECRET = process.env.SHARED_SECRET || "";

// ---------- helpers ----------

// TypeID gen — prefix_<26 char Crockford base32> (igual ao da edge function)
function genLovableId(prefix) {
  const crockford = "0123456789abcdefghjkmnpqrstvwxyz";
  let ts = Date.now();
  let timePart = "";
  for (let i = 0; i < 10; i++) {
    timePart = crockford[ts % 32] + timePart;
    ts = Math.floor(ts / 32);
  }
  let randPart = "";
  for (let i = 0; i < 16; i++) {
    randPart += crockford[Math.floor(Math.random() * 32)];
  }
  return `${prefix}_${timePart}${randPart}`;
}

function buildEventId() {
  const b32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let bldSuffix = "";
  for (let i = 0; i < 8; i++) bldSuffix += b32[Math.floor(Math.random() * 32)];
  let agentNum = "";
  for (let i = 0; i < 14; i++) agentNum += Math.floor(Math.random() * 10);
  return `main:agent#${agentNum}#bld:${bldSuffix}`;
}

// ---------- routes ----------

app.get("/health", (_req, res) => res.json({ ok: true, service: "quantum-v3", t: Date.now() }));

app.post("/v3", async (req, res) => {
  try {
    // Shared secret opcional
    if (SHARED_SECRET) {
      const got = req.header("x-shared-secret") || "";
      if (got !== SHARED_SECRET) {
        return res.status(401).json({ success: false, error_display: "unauthorized" });
      }
    }

    const {
      projeto_id,
      mensagem,
      chat_only = true,
      // Token Bearer do Lovable (o mesmo que a extensão captura). Pode vir
      // no body como `bearer_token`/`lovable_token` ou no header Authorization.
      bearer_token,
      lovable_token,
      // Anexos no formato esperado pelo /chat
      // (mesmo shape que a edge function gera após o upload V2)
      files = [],
      optimisticImageUrls = [],
      // Opcionais — sessão de browser usada pelo Lovable
      browser_session_id,
      viewport_width = 878,
      viewport_height = 678,
      viewport_dpr = 1.25,
    } = req.body || {};

    const rawToken =
      bearer_token ||
      lovable_token ||
      (req.header("authorization") || "").replace(/^Bearer\s+/i, "");

    if (!projeto_id) return res.status(400).json({ success: false, error_display: "projeto_id obrigatório" });
    if (!rawToken)   return res.status(400).json({ success: false, error_display: "bearer_token obrigatório" });
    if (typeof mensagem !== "string" || !mensagem.trim()) {
      return res.status(400).json({ success: false, error_display: "mensagem obrigatória" });
    }

    const hasImages = (files && files.length > 0) || (optimisticImageUrls && optimisticImageUrls.length > 0);
    const bld = buildEventId();

    const v3Payload = {
      id: genLovableId("umsg"),
      message: mensagem,
      files,
      selected_elements: [],
      chat_only: !!chat_only,
      optimisticImageUrls,
      intent: "fix_error",
      message_intent_metadata: {
        fix_error_metadata: {
          errors: [
            { error_type: "build", error_message: "", build_event_id: bld },
          ],
        },
      },
      contains_error: true,
      error_ids: [bld],
      ai_message_id: genLovableId("aimsg"),
      thread_id: "main",
      current_page: "/",
      current_viewport_width: viewport_width,
      current_viewport_height: viewport_height,
      current_viewport_dpr: viewport_dpr,
      view: "preview",
      view_description: "The user is currently viewing the preview. ",
      model: null,
      session_replay: "",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      integration_metadata: {
        browser: {
          preview_viewport_width: viewport_width,
          preview_viewport_height: viewport_height,
        },
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawToken}`,
      Accept: "*/*",
      Origin: "https://lovable.dev",
      Referer: "https://lovable.dev/",
    };
    if (browser_session_id) headers["X-Browser-Session-ID"] = browser_session_id;

    const url = `${LOVABLE_API_URL}/projects/${encodeURIComponent(projeto_id)}/chat`;
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(v3Payload),
    });

    if (upstream.ok || upstream.status === 202) {
      return res.json({
        success: true,
        message: "Prompt Enviado com Sucesso.",
        method: "v3",
        had_images: hasImages,
        message_id: v3Payload.id,
        ai_message_id: v3Payload.ai_message_id,
      });
    }

    const errText = await upstream.text();
    console.error("V3 chat failed", upstream.status, errText);
    return res.status(200).json({
      success: false,
      error_display: errText || `Lovable retornou status ${upstream.status}`,
      status: upstream.status,
    });
  } catch (err) {
    console.error("V3 error", err);
    return res.status(200).json({ success: false, error_display: "Erro de rede ao enviar prompt." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`quantum-v3 listening on :${PORT}`));
