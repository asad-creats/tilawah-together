const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function isIsoDate(v) {
  return typeof v === 'string' && !Number.isNaN(new Date(v).getTime());
}

function latestDateForUid(entries, uid) {
  const mine = (entries || []).filter((e) => e && e.uid === uid && isIsoDate(e.date));
  if (!mine.length) return '';
  return mine.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b)).date;
}

function newlyAdded(beforeArr, afterArr) {
  const beforeLen = Array.isArray(beforeArr) ? beforeArr.length : 0;
  const afterList = Array.isArray(afterArr) ? afterArr : [];
  if (afterList.length <= beforeLen) return [];
  return afterList.slice(beforeLen);
}

function buildMessage(type, partnerName) {
  const p = partnerName || 'Your partner';
  const map = {
    quranLog: `${p} added new Quran progress`,
    fitLog: `${p} logged new fitness progress`,
    instaLog: `${p} updated Insta usage`,
    tafseerLog: `${p} added a new tafseer note`,
    sharedLog: `${p} shared a new note`
  };
  return map[type] || `${p} added a new update`;
}

async function notifyRecipient(recipientUid, body) {
  if (!recipientUid) return;
  const userSnap = await db.collection('users').doc(recipientUid).get();
  if (!userSnap.exists) return;

  const data = userSnap.data() || {};
  const tokens = Array.isArray(data.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];
  if (!tokens.length) return;

  const msg = {
    notification: {
      title: 'Tilawah Together',
      body
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'updates',
        sound: 'default'
      }
    },
    tokens
  };

  const result = await admin.messaging().sendEachForMulticast(msg);

  const invalid = [];
  result.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
    const cleaned = tokens.filter((t) => !invalid.includes(t));
    await db.collection('users').doc(recipientUid).set({ fcmTokens: cleaned }, { merge: true });
  }
}

exports.notifyPartnerOnCoupleUpdate = onDocumentUpdated('couples/{coupleId}', async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};

  const member1uid = after.member1uid || before.member1uid || null;
  const member2uid = after.member2uid || before.member2uid || null;
  const member1name = after.member1name || before.member1name || 'Partner';
  const member2name = after.member2name || before.member2name || 'Partner';

  const logTypes = ['quranLog', 'fitLog', 'instaLog', 'tafseerLog', 'sharedLog'];

  for (const type of logTypes) {
    const added = newlyAdded(before[type], after[type]);
    if (!added.length) continue;

    for (const entry of added) {
      const actorUid = entry && entry.uid;
      if (!actorUid) continue;

      let recipientUid = null;
      let actorName = 'Your partner';

      if (actorUid === member1uid) {
        recipientUid = member2uid;
        actorName = member1name;
      } else if (actorUid === member2uid) {
        recipientUid = member1uid;
        actorName = member2name;
      } else {
        // Fallback for legacy/incorrect entries: infer actor from latest timestamp by uid.
        const m1Latest = latestDateForUid(after[type], member1uid);
        const m2Latest = latestDateForUid(after[type], member2uid);
        if (m1Latest && (!m2Latest || new Date(m1Latest) >= new Date(m2Latest))) {
          recipientUid = member2uid;
          actorName = member1name;
        } else {
          recipientUid = member1uid;
          actorName = member2name;
        }
      }

      if (!recipientUid || recipientUid === actorUid) continue;
      const body = buildMessage(type, actorName);
      await notifyRecipient(recipientUid, body);
    }
  }

  logger.info('Processed couple update notifications', { coupleId: event.params.coupleId });
});
