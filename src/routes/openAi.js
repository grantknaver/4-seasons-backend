import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

router.post('/submit-logs', async (req, res) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = req.body;
    const logs = Array.isArray(body) ? body : body?.logs;
    if (!Array.isArray(logs)) {
      return res.status(400).json({ ok: false, message: '`logs` must be an array of messages' });
    }

    const normalized = logs
      .map((m) => {
        const rawRole = String(m?.role ?? '').toLowerCase();
        const role =
          rawRole === 'system' ||
          rawRole === 'developer' ||
          rawRole === 'user' ||
          rawRole === 'assistant' ||
          rawRole === 'tool'
            ? rawRole
            : rawRole; // keep as-is (will be filtered below if invalid)

        const parts = Array.isArray(m?.content) ? m.content : [];
        const normParts = parts
          .map((p) => {
            const txt = String(p?.text ?? '').trim();
            if (!txt) return null;

            const t = String(p?.type ?? '').toLowerCase();

            if (role === 'assistant') {
              // Assistant must emit output types
              if (t === 'refusal') return { type: 'refusal', text: txt };
              return { type: 'output_text', text: txt };
            }

            // system / developer / user / tool -> input types
            return { type: 'input_text', text: txt };
          })
          .filter(Boolean);

        return { role, content: normParts };
      })
      // Keep only valid roles with at least one part
      .filter(
        (m) =>
          ['system', 'developer', 'user', 'assistant', 'tool'].includes(m.role) &&
          Array.isArray(m.content) &&
          m.content.length > 0
      );

    if (normalized.length === 0) {
      return res.status(400).json({ ok: false, message: 'No valid messages after normalization' });
    }

    // Optional: cap history
    const MAX_MESSAGES = 60;
    const payload = normalized.slice(-MAX_MESSAGES);

    // Guard against illegal 'text' parts sneaking in
    const illegal = [];
    payload.forEach((msg, i) =>
      msg.content.forEach((part, j) => {
        if (part.type === 'text') illegal.push({ i, j, role: msg.role, part });
      })
    );
    if (illegal.length) {
      console.error('[submit-logs] illegal "text" parts:', illegal);
      return res.status(400).json({
        ok: false,
        message:
          'Found illegal content.type "text" in payload; expected input_text/output_text/refusal.',
        details: illegal,
      });
    }

    // Call Responses API
    const oaResponse = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: payload,
      temperature: 0.5,
    });

    return res.status(200).json({
      ok: true,
      text: oaResponse.output_text ?? '',
    });
  } catch (err) {
    console.error('[submit-logs] error:', {
      status: err?.status,
      code: err?.code,
      message: err?.message,
      details: err?.response?.data,
    });
    const status = err?.status ?? 500;
    return res.status(status).json({
      ok: false,
      message: err?.message ?? 'Server error',
      code: err?.code,
      details: err?.response?.data,
    });
  }
});

export default router;
