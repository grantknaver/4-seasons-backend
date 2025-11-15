// import { Router } from 'express';

// const router = Router();

// router.post('/verify-recaptcha', async (req, res) => {
//   try {
//     const secret = process.env.RECAPTCHA_SECRET;
//     if (!secret) {
//       console.error('[reCAPTCHA] Missing RECAPTCHA_SECRET');
//       return res.status(500).json({ error: 'Server misconfigured' });
//     }

//     const token = req.body && req.body.token;
//     if (!token) {
//       return res.status(400).json({ error: 'Missing reCAPTCHA token' });
//     }

//     const params = new URLSearchParams();
//     params.set('secret', secret);
//     params.set('response', token);

//     const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
//       method: 'POST',
//       headers: { 'content-type': 'application/x-www-form-urlencoded' },
//       credentials: 'include',
//       body: params,
//     });

//     const text = await googleRes.text();
//     let result = {};
//     try {
//       result = JSON.parse(text);
//     } catch (_) {}

//     if (!googleRes.ok) {
//       console.error('[reCAPTCHA] Upstream error:', googleRes.status, text);
//       return res.status(502).json({ error: 'Verification service error' });
//     }

//     if (!result.success) {
//       return res.status(400).json({
//         error: 'reCAPTCHA failed',
//         details: result['error-codes'],
//       });
//     }
//     res.cookie('isHuman', 'true', {
//       httpOnly: true,
//       path: '/',
//       sameSite: 'lax',
//       secure: false,
//       maxAge: 10 * 60 * 1000,
//       signed: true,
//     });
//     const { success } = result;
//     return res.json({ success });
//   } catch (error) {
//     const { message, status, code } = error;
//     return res.status(status).json({ message, status, code });
//   }
// });

// router.get('/verify-status', async (req, res) => {
//   const isHuman = req.signedCookies?.isHuman;
//   res.json({ isHuman: !!isHuman });
// });

// export default router;

import { Router } from 'express';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

// Cookie options
const baseCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000, // 10 minutes
  signed: true,
};

const prodCookieOptions = {
  ...baseCookieOptions,
  secure: true, // cookie only over HTTPS
  domain: '.glkfreelance.com', // <-- allows cookie on root, www, and api
};

const devCookieOptions = {
  ...baseCookieOptions,
  secure: false, // OK on localhost
  // no domain for dev (defaults to localhost)
};

router.post('/verify-recaptcha', async (req, res) => {
  try {
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret) {
      console.error('[reCAPTCHA] Missing RECAPTCHA_SECRET');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const token = req.body?.token;
    if (!token) {
      return res.status(400).json({ error: 'Missing reCAPTCHA token' });
    }

    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);

    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const text = await googleRes.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch (_) {}

    if (!googleRes.ok) {
      console.error('[reCAPTCHA] Upstream error:', googleRes.status, text);
      return res.status(502).json({ error: 'Verification service error' });
    }

    if (!result.success) {
      return res.status(400).json({
        error: 'reCAPTCHA failed',
        details: result['error-codes'],
      });
    }

    // -------------------------------
    // SUCCESS: Set Cookie
    // -------------------------------
    res.cookie('isHuman', 'true', isProduction ? prodCookieOptions : devCookieOptions);

    return res.json({ success: true });
  } catch (error) {
    console.error('[verify-recaptcha] ERROR:', error);
    return res.status(500).json({
      message: error?.message || 'Unexpected error',
      code: error?.code || 'unknown',
    });
  }
});

router.get('/verify-status', (req, res) => {
  const isHuman = req.signedCookies?.isHuman;
  res.json({ isHuman: !!isHuman });
});

export default router;
