const express = require("express");
const admin = require("firebase-admin");

const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://dalta-d4f41-default-rtdb.firebaseio.com";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "dalta-d4f41";
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!SERVICE_ACCOUNT_JSON) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
} catch (error) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:", error.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();
const messaging = admin.messaging();
const app = express();
app.disable("x-powered-by");
app.get("/", (_req, res) => res.status(200).send("Delta push server is running."));
app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "delta-push-server" }));

const statusLabels = {
  live: "بدأت المباراة الآن",
  second_half: "بدأ الشوط الثاني",
  half_time: "انتهى الشوط الأول",
  finished: "انتهت المباراة",
  ended: "انتهت المباراة",
  completed: "انتهت المباراة"
};

function safeText(value, fallback = "") {
  return String(value == null ? fallback : value).replace(/\s+/g, " ").trim().slice(0, 180);
}

function matchTitle(match, id) {
  const home = safeText(match.homeTeamName || match.homeName || match.homeTeam || match.team1 || match.home || "الفريق الأول");
  const away = safeText(match.awayTeamName || match.awayName || match.awayTeam || match.team2 || match.away || "الفريق الثاني");
  return `${home} × ${away}`.slice(0, 180);
}

function categoryEnabled(record, type) {
  if (!record || record.enabled === false || !record.token) return false;
  const cats = record.categories || {};
  if (type === "goal") return cats.scoreChanges !== false;
  if (type === "status") return cats.matchStart !== false;
  return true;
}

async function sendToSubscribers({ title, body, type, matchId, eventId }) {
  const snap = await db.ref("publicNotificationSubscriptions").once("value");
  const records = snap.val() || {};
  const tokens = [];
  for (const [uid, record] of Object.entries(records)) {
    if (categoryEnabled(record, type)) tokens.push({ uid, token: record.token });
  }
  if (!tokens.length) {
    console.log("No eligible push tokens for", type);
    return;
  }

  // Send in small batches to keep the sender within FCM limits.
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map(item => item.token),
      notification: { title: safeText(title, "أكاديمية دلتا أبين الرياضية"), body: safeText(body, "لديك تحديث جديد من الأكاديمية") },
      data: {
        type: safeText(type, "general"),
        matchId: safeText(matchId),
        eventId: safeText(eventId),
        url: "/"
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          renotify: false,
          tag: `${safeText(type, "delta")}-${safeText(matchId, "general")}-${safeText(eventId, "update")}`
        },
        fcmOptions: { link: "https://daltaa.onrender.com/" }
      }
    });

    response.responses.forEach(async (result, index) => {
      if (!result.success) {
        const code = result.error && result.error.code;
        console.warn("FCM send failed:", code || result.error?.message || "unknown");
        if (code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token") {
          // Disable the stale token; never delete other users' records.
          try {
            await db.ref(`publicNotificationSubscriptions/${batch[index].uid}/enabled`).set(false);
          } catch (error) {
            console.warn("Could not disable stale token:", error.message);
          }
        }
      }
    });
    console.log(`FCM ${type}: ${response.successCount} sent, ${response.failureCount} failed.`);
  }
}

function isGoal(event) {
  return event && String(event.type || "").toLowerCase() === "goal";
}

const matchSubscriptions = new Map();
const seenEventIds = new Map();
const previousStatuses = new Map();
const pendingTimers = new Map();

function scheduleStatusNotification(matchId, match) {
  const status = safeText(match && match.status).toLowerCase();
  if (!statusLabels[status]) return;
  const key = `${matchId}:${status}`;
  if (previousStatuses.get(matchId) === status) return;
  previousStatuses.set(matchId, status);

  // Suppress the initial database snapshot; only send for subsequent status changes.
  if (!match.__deltaHasChanged) return;

  const title = matchTitle(match, matchId);
  const body = statusLabels[status];
  sendToSubscribers({ title: "أكاديمية دلتا أبين الرياضية", body: `${title}: ${body}`, type: "status", matchId }).catch(err => {
    console.error("Status notification failed:", err.message);
  });
}

function attachMatchStatusListener(matchId) {
  const ref = db.ref(`Matches/${matchId}`);
  let initialized = false;
  let previous = null;
  const listener = snapshot => {
    if (!snapshot.exists()) return;
    const match = snapshot.val() || {};
    if (!initialized) {
      initialized = true;
      previous = safeText(match.status).toLowerCase();
      previousStatuses.set(matchId, previous);
      return;
    }
    const next = safeText(match.status).toLowerCase();
    if (next && next !== previous) {
      previous = next;
      match.__deltaHasChanged = true;
      scheduleStatusNotification(matchId, match);
    }
  };
  ref.on("value", listener, error => console.error("Match status listener failed:", matchId, error.message));
  return () => ref.off("value", listener);
}

function attachEventListener(matchId) {
  const ref = db.ref(`MatchEvents/${matchId}`);
  const seen = new Set();
  let initialized = false;
  const listener = snapshot => {
    if (!snapshot.exists()) {
      initialized = true;
      return;
    }
    const events = snapshot.val() || {};
    const entries = Object.entries(events);
    if (!initialized) {
      for (const [id] of entries) seen.add(id);
      initialized = true;
      return;
    }
    for (const [eventId, event] of entries) {
      if (seen.has(eventId)) continue;
      seen.add(eventId);
      if (!isGoal(event)) continue;
      const side = safeText(event.team).toLowerCase();
      const scorer = safeText(event.playerName || event.scorerName || event.player || "");
      const minute = event.minute != null ? `${safeText(event.minute)}′` : "";
      const sideLabel = side === "home" ? "الفريق المضيف" : side === "away" ? "الفريق الضيف" : "";
      const pieces = ["تم تسجيل هدف", sideLabel, scorer, minute].filter(Boolean);
      sendToSubscribers({
        title: "هدف جديد! ⚽",
        body: pieces.join(" — "),
        type: "goal",
        matchId,
        eventId
      }).catch(err => console.error("Goal notification failed:", err.message));
    }
  };
  ref.on("value", listener, error => console.error("Match event listener failed:", matchId, error.message));
  return () => ref.off("value", listener);
}

function attachMatch(matchId) {
  if (matchSubscriptions.has(matchId)) return;
  const cleanups = [attachMatchStatusListener(matchId), attachEventListener(matchId)];
  matchSubscriptions.set(matchId, cleanups);
}

function detachMatch(matchId) {
  const cleanups = matchSubscriptions.get(matchId);
  if (cleanups) cleanups.forEach(fn => fn());
  matchSubscriptions.delete(matchId);
  seenEventIds.delete(matchId);
  previousStatuses.delete(matchId);
}

// Existing matches are watched without sending notifications for their initial state.
// New match records are automatically attached as they appear.
async function startWatchers() {
  const matchesRef = db.ref("Matches");
  const initial = await matchesRef.once("value");
  const data = initial.val() || {};
  for (const id of Object.keys(data)) attachMatch(id);

  matchesRef.on("child_added", snapshot => attachMatch(snapshot.key), error => {
    console.error("Matches child_added listener failed:", error.message);
  });
  matchesRef.on("child_removed", snapshot => detachMatch(snapshot.key), error => {
    console.error("Matches child_removed listener failed:", error.message);
  });

  console.log(`Watching ${Object.keys(data).length} existing matches and future match changes.`);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Delta push server listening on port ${PORT}`);
  startWatchers().catch(error => {
    console.error("Could not start Firebase watchers:", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  for (const id of matchSubscriptions.keys()) detachMatch(id);
  process.exit(0);
});
