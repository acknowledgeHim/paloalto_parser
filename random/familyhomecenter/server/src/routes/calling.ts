import { Router } from 'express';
import twilio from 'twilio';
import { config } from '../config.js';

// Real click-to-call from a desktop/kiosk browser via Twilio Voice — a paid, opt-in integration
// (see docs/TWILIO_CALLING_SETUP.md), unlike the rest of Contacts (tel:/sms: links, email-to-SMS)
// which need no external account at all. Open to everyone, same as Call/Text — placing a call
// isn't an edit to a contact, and this app doesn't otherwise gate everyday actions behind a
// password (see docs/SETTINGS_LOGIN.md).
export const callingRouter = Router();

function isConfigured(): boolean {
  return Boolean(
    config.twilio.accountSid && config.twilio.apiKeySid && config.twilio.apiKeySecret && config.twilio.twimlAppSid && config.twilio.callerNumber
  );
}

/** GET /status — whether the client should even offer the "Call (browser)" button. */
callingRouter.get('/status', (_req, res) => {
  res.json({ enabled: isConfigured() });
});

/**
 * GET /token?identity=<name> — a short-lived Twilio Voice access token for the browser SDK
 * (@twilio/voice-sdk) to register a Device with. identity is just a label Twilio logs against the
 * call (who placed it) — not an auth mechanism itself, so any string is accepted; defaults to
 * "family" if omitted.
 */
callingRouter.get('/token', (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'Calling is not configured' });

  const identity = (req.query.identity as string)?.trim() || 'family';
  const AccessToken = twilio.jwt.AccessToken;
  const token = new AccessToken(config.twilio.accountSid, config.twilio.apiKeySid, config.twilio.apiKeySecret, { identity });
  token.addGrant(
    new AccessToken.VoiceGrant({
      outgoingApplicationSid: config.twilio.twimlAppSid,
      incomingAllow: false, // outbound-only — nobody can call *into* this kiosk
    })
  );
  res.json({ token: token.toJwt(), identity });
});

/**
 * POST /voice — the TwiML webhook Twilio itself calls (not our client) when the Voice SDK places
 * an outbound call, per the TwiML App's configured Voice Request URL. Must be reachable from the
 * public internet over HTTPS — see docs/TWILIO_CALLING_SETUP.md for exposing this via a tunnel.
 * Twilio POSTs form-encoded (not JSON) — see index.ts's route-scoped express.urlencoded().
 */
callingRouter.post('/voice', (req, res) => {
  const to = (req.body?.To as string | undefined)?.trim();
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  if (!to) {
    twiml.say('No number was given to call.');
  } else {
    twiml.dial({ callerId: config.twilio.callerNumber }).number(to);
  }
  res.type('text/xml').send(twiml.toString());
});
