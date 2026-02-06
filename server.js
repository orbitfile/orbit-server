const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Expo } = require('expo-server-sdk');

const app = express();
const expo = new Expo();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- DATABASE (In-Memory for Demo) ---
// Note: This resets if the free server restarts.
// For permanent data, you would connect MongoDB here.
let users = {}; 
let withdrawals = [];
let adminSettings = {
  maintenanceMode: false,
  announcement: "",
  rewardMultiplier: 1
};

// --- API ROUTES ---

// 1. Sync User Data
app.post('/api/sync', (req, res) => {
  const { uid, balance, streak, pushToken, version } = req.body;
  const timestamp = new Date();
  
  users[uid] = { 
    ...users[uid], 
    uid, balance, streak, version, pushToken, 
    lastActive: timestamp.toISOString() 
  };
  
  res.json({ success: true, settings: adminSettings });
});

// 2. Submit Withdrawal
app.post('/api/withdraw', (req, res) => {
  const { txnId, userId, amount, method, payout, phone, network } = req.body;
  
  // Avoid duplicates
  if (!withdrawals.find(w => w.txnId === txnId)) {
    withdrawals.unshift({
      txnId, userId, amount, method, payout, phone, network,
      date: new Date().toISOString(),
      status: 'Pending'
    });
  }
  res.json({ success: true });
});

// --- ADMIN ROUTES ---

app.get('/admin/data', (req, res) => {
  res.json({ users: Object.values(users), withdrawals, settings: adminSettings });
});

app.post('/admin/update-withdrawal', (req, res) => {
  const { txnId, status } = req.body;
  const txn = withdrawals.find(w => w.txnId === txnId);
  if (txn) txn.status = status;
  res.json({ success: true });
});

app.post('/admin/update-settings', (req, res) => {
  adminSettings = { ...adminSettings, ...req.body };
  res.json({ success: true });
});

app.post('/admin/broadcast', async (req, res) => {
  const { title, body } = req.body;
  let messages = [];
  
  for (let uid in users) {
    const token = users[uid].pushToken;
    if (Expo.isExpoPushToken(token)) {
      messages.push({ to: token, sound: 'default', title, body });
    }
  }

  let chunks = expo.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { console.error(e); }
  }
  res.json({ success: true, count: messages.length });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
