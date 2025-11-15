export default function requireRecaptcha(req, res, next) {
  console.log('req.signedCookies', !!req.signedCookies);
  console.log('req.signedCookies.isHuman', req.signedCookies.isHuman);
  const ok = !!req.signedCookies && !!req.signedCookies.isHuman;
  console.log('ok', ok);
  if (!ok) return res.status(403).json({ success: false, error: 'RECAPTCHA_REQUIRED' });
  next();
}
