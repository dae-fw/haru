import webpush from "web-push";

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send one payload to many subscriptions. Returns the endpoints that are gone (410/404). */
export async function sendPush(
  subs: PushSub[],
  payload: PushPayload,
): Promise<{ sent: number; stale: string[] }> {
  init();
  const data = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
        else console.error("push send failed", code, err);
      }
    }),
  );

  return { sent, stale };
}
