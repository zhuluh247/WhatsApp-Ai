require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const admin = require('firebase-admin');

// --- 1. FIREBASE INITIALIZATION ---
const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.database();

// --- 2. EXPRESS SETUP ---
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// --- 3. CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const RIDER_REG_CODE = process.env.RIDER_REG_CODE;
const DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE) || 500;
const SHOPPING_FEE = parseInt(process.env.SHOPPING_FEE) || 500;

// Initialize Twilio Client
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- 4. MENU DATA (Bissy Joy Eatery) ---
const VENDOR_NAME = "Bissy Joy Eatery";
const MENU_CATEGORIES = {
  "RICE_MEALS": [
    { id: 1, name: "White Rice", reg: 2500, ext: 3000 },
    { id: 2, name: "Jollof & Fried Rice", reg: 2500, ext: 3000 },
    { id: 3, name: "Chinese Rice", reg: 4000, ext: 5000 },
    { id: 4, name: "Village Rice", reg: 4000, ext: 4500 },
    { id: 5, name: "Jollof Macaroni", reg: 3000, ext: 3500 },
    { id: 6, name: "Jollof Spaghetti", reg: 3000, ext: 3500 },
    { id: 7, name: "Ofada Rice", reg: 4000, ext: 5000 },
    { id: 8, name: "Beans & Rice", reg: 3000, ext: 3500 }
  ],
  "SWALLOWS": [
    { id: 9, name: "Yam Porridge", reg: 3000, ext: 3500 },
    { id: 10, name: "Yam & Egg", reg: 3000, ext: 3500 },
    { id: 11, name: "Beans & Bread", reg: 2500, ext: 3000 },
    { id: 12, name: "Eba", reg: 2500, ext: 3000 },
    { id: 13, name: "Amala", reg: 2500, ext: 3000 },
    { id: 14, name: "Fufu", reg: 3000, ext: 3500 },
    { id: 15, name: "Pounded Yam", reg: 2500, ext: 3000 }
  ],
  "PROTEINS": [
    { id: 16, name: "Pepper Soup", reg: 2800, ext: 3000 },
    { id: 17, name: "Chicken", reg: 2000, ext: 2500 },
    { id: 18, name: "Turkey", reg: 3500, ext: 4000 },
    { id: 19, name: "Fish", reg: 2000, ext: 2500 },
    { id: 20, name: "Assorted", reg: 500, ext: 1000 },
    { id: 21, name: "Goat Meat", reg: 500, ext: 1000 },
    { id: 22, name: "Ponmo", reg: 200, ext: 500 },
    { id: 23, name: "Beef", reg: 500, ext: 500 }, 
    { id: 24, name: "Egg", reg: 300, ext: 300 }
  ]
};

// --- 5. HELPERS ---
function generateId() {
  return Math.floor(1000 + Math.random() * 9000);
}

function formatCurrency(amount) {
  return `₦${amount.toLocaleString()}`;
}

// --- 6. SMART SENDER (Tries Buttons, Falls back to Text) ---
async function sendSmart(to, bodyText, actionConfig, fallbackTextOptions) {
  // ATTEMPT 1: SEND BUTTONS
  try {
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
      body: bodyText,
      action: actionConfig
    });
    console.log("Sent Buttons successfully.");
    return; // Success!
  } catch (err) {
    console.log("Buttons failed (Likely Sandbox). Sending Text Menu...");
    console.error(err);
  }

  // ATTEMPT 2: FALLBACK TO TEXT
  let textMenu = bodyText + "\n\n";
  if (fallbackTextOptions && fallbackTextOptions.type === 'buttons') {
    fallbackTextOptions.buttons.forEach(btn => {
      textMenu += `${btn.id}. ${btn.title}\n`;
    });
  } else if (fallbackTextOptions && fallbackTextOptions.type === 'list') {
    // Flatten list to text
    let count = 1;
    fallbackTextOptions.items.forEach(item => {
        textMenu += `${count}. ${item.title}\n`;
        count++;
    });
  }
  
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: to,
    body: textMenu
  });
}

// --- 7. MAIN WEBHOOK ROUTE ---
app.post('/whatsapp', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const msg = body.toLowerCase(); 
  const originalMsg = body; 
  const numMedia = parseInt(req.body.NumMedia) || 0;

  console.log(`[${new Date().toISOString()}] From: ${from}, Msg: ${body}, Media: ${numMedia}`);

  try {
    // --- A. MEDIA HANDLING ---
    if (numMedia > 0) {
      const userSnap = await db.ref(`users/${from}`).once('value');
      const user = userSnap.val();
      if (user && user.step === 'awaiting_payment') {
        await createOrderInDB(from, user);
      } else {
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Please complete steps first." });
      }
      return res.send('');
    }

    // --- B. RIDER REGISTRATION ---
    if (msg.startsWith('register rider ')) {
      const parts = originalMsg.split(' ');
      const code = parts[2];
      const riderName = parts.slice(3).join(' ') || "Rider";
      if (code === RIDER_REG_CODE) {
        await db.ref(`riders/${from}`).set({ name: riderName, status: 'inactive', phone: from, joined_at: new Date().toISOString() });
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `✅ Welcome ${riderName}. Text ON DUTY.` });
      } else {
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "❌ Invalid Code." });
      }
      return res.send('');
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val() || { step: 'new' };

    // --- C. ADMIN COMMANDS ---
    if (from === ADMIN_PHONE) {
      if (msg.startsWith('approve ')) {
        await approveOrder(msg.split(' ')[1]);
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Order Approved.` });
        return res.send('');
      }
      if (msg.startsWith('reject ')) {
        await rejectOrder(msg.split(' ')[1]);
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Order Rejected.` });
        return res.send('');
      }
    }

    // --- D. RIDER COMMANDS ---
    const riderSnap = await db.ref(`riders/${from}`).once('value');
    const rider = riderSnap.val();

    if (rider) {
      if (msg === 'on duty') {
        await db.ref(`riders/${from}/status`).set('on_duty');
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: '✅ ON DUTY.' });
        return res.send('');
      }
      if (msg === 'off duty') {
        await db.ref(`riders/${from}/status`).set('inactive');
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: '⚠️ OFF DUTY.' });
        return res.send('');
      }
      if (msg.startsWith('accept ')) {
        await acceptOrder(from, msg.split(' ')[1]);
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `✅ Order Accepted.` });
        return res.send('');
      }
      if (msg.startsWith('delivered')) {
        await updateOrderStatus(msg.split(' ')[1], 'delivered', from);
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `✅ Delivered.` });
        return res.send('');
      }
    }

    // --- E. CUSTOMER FLOW STATE MACHINE ---
    if (msg === 'hi' || msg === 'menu' || msg === '0') {
      await resetUser(from);
      return res.send('');
    }

    switch (user.step) {
      case 'new':
      case 'main_menu':
        await handleMainMenu(from, msg);
        break;
      case 'vendor_select':
        if (msg === '1') await showCategories(from);
        else await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid." });
        break;
      case 'category_select':
        await handleCategorySelect(from, parseInt(msg));
        break;
      case 'item_select':
        await handleItemSelect(from, parseInt(msg));
        break;
      case 'size_select':
        await handleSizeSelect(from, msg);
        break;
      case 'quantity_select':
        await handleQuantitySelect(from, parseInt(msg));
        break;
      case 'protein_loop':
        await handleProteinLoop(from, msg);
        break;
      case 'protein_select':
        await handleProteinSelect(from, parseInt(msg));
        break;
      case 'protein_size':
        await handleProteinSize(from, msg);
        break;
      case 'protein_qty':
        await handleProteinQty(from, parseInt(msg));
        break;
      case 'add_more_or_checkout':
        if (msg === '1') await showCategories(from); 
        else if (msg === '2') await handleDeliveryLocation(from, ""); 
        else await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid." });
        break;
      case 'errand_type':
        await handleErrandType(from, parseInt(msg));
        break;
      case 'errand_details':
        await handleErrandDetails(from, originalMsg);
        break;
      case 'errand_location':
        await handleErrandLocation(from, originalMsg);
        break;
      case 'delivery_location':
        await handleDeliveryLocation(from, originalMsg);
        break;
      case 'phone_number':
        await handlePhoneNumber(from, originalMsg);
        break;
      case 'confirm_order':
        await handleFinalConfirm(from, msg);
        break;
      default:
        await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "I didn't understand. Reply Menu." });
    }

    res.send('');

  } catch (error) {
    console.error("Error:", error);
    await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "❌ Bot Error. Please try again." });
    res.send('');
  }
});

// --- 8. LOGIC HANDLERS ---

async function resetUser(from) {
  await db.ref(`users/${from}`).set({ step: 'main_menu', cart: [], order_type: null });
  await sendSmart(from, `🍽️ *Welcome to ChowZone!*`, {
    type: 'buttons',
    buttons: [{ type: 'reply', id: "1", title: "Order Food" }, { type: 'reply', id: "2", title: "Errands" }]
  }, { type: 'buttons', buttons: [{ id: "1", title: "Order Food" }, { id: "2", title: "Errands" }] });
}

async function handleMainMenu(from, msg) {
  if (msg === '1') {
    await db.ref(`users/${from}`).update({ step: 'vendor_select', order_type: 'food' });
    await sendSmart(from, `🏪 *Select Vendor*`, {
      type: 'buttons',
      buttons: [{ type: 'reply', id: "1", title: VENDOR_NAME }]
    }, { type: 'buttons', buttons: [{ id: "1", title: VENDOR_NAME }] });
  } else if (msg === '2') {
    await db.ref(`users/${from}`).update({ step: 'errand_type', order_type: 'errand' });
    await sendSmart(from, "🏃 *Select Errand Type*", {
      type: 'list',
      list: { button: "Choose", sections: [{ title: "Type", rows: [{id:"1",title:"Market"}, {id:"2",title:"Pick Up"}, {id:"3",title:"Pharmacy"}, {id:"4",title:"Task"}] }] }
    }, { type: 'list', items: [{id:"1",title:"🛒 Market"}, {id:"2",title:"📦 Pick Up"}, {id:"3",title:"💊 Pharmacy"}, {id:"4",title:"📝 Task"}] });
  } else {
    await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid." });
  }
}

async function showCategories(from) {
  await db.ref(`users/${from}/step`).set('category_select');
  await sendSmart(from, `🍽️ *${VENDOR_NAME} Categories*`, {
    type: 'buttons',
    buttons: [{ type: 'reply', id: "1", title: "Rice Meals" }, { type: 'reply', id: "2", title: "Swallow" }, { type: 'reply', id: "3", title: "Proteins" }]
  }, { type: 'buttons', buttons: [{ id: "1", title: "Rice Meals" }, { id: "2", title: "Swallow" }, { id: "3", title: "Proteins" }] });
}

async function handleCategorySelect(from, choice) {
  let cat = choice===1?'RICE_MEALS':choice===2?'SWALLOWS':choice===3?'PROTEINS':null;
  if (!cat) return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid cat." });
  await db.ref(`users/${from}`).update({ step: 'item_select', current_category: cat });
  const items = MENU_CATEGORIES[cat].map(i=>({id:i.id.toString(),title:i.name,description:`₦${i.reg}`}));
  await sendSmart(from, `*${cat}*`, {
    type: 'list',
    list: { button: "Choose", sections: [{ title: "Pick", rows: items }] }
  }, { type: 'list', items });
}

async function handleItemSelect(from, id) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const item = MENU_CATEGORIES[user.current_category].find(i=>i.id===id);
  if (!item) return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid item." });
  await db.ref(`users/${from}`).update({ step: 'size_select', selected_item: item });
  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('quantity_select');
    await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Price: ${formatCurrency(item.reg)}\n\nHow many?` });
  } else {
    await sendSmart(from, `*${item.name}*`, {
      type: 'buttons',
      buttons: [{ type: 'reply', id: "1", title: `Regular ${formatCurrency(item.reg)}` }, { type: 'reply', id: "2", title: `Extra ${formatCurrency(item.ext)}` }]
    }, { type: 'buttons', buttons: [{ id: "1", title: "Regular" }, { id: "2", title: "Extra" }] });
  }
}

async function handleSizeSelect(from, choice) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const item = user.selected_item;
  const size = choice === 1 ? 'reg' : 'ext';
  await db.ref(`users/${from}`).update({ step: 'quantity_select', selected_item_price: item[size], selected_size: choice===1?'Regular':'Extra' });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Price: ${formatCurrency(item[size])}\n\nHow many?` });
}

async function handleQuantitySelect(from, qty) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const item = user.selected_item;
  const newItem = { name: item.name, price: user.selected_item_price||item.reg, qty, size: user.selected_size||'Regular', type: user.current_category==='PROTEINS'?'protein':'main' };
  const cart = user.cart||[]; cart.push(newItem);
  if (user.current_category !== 'PROTEINS') {
    await db.ref(`users/${from}`).update({ step: 'protein_loop', cart });
    await sendSmart(from, `✅ Added ${qty}x ${item.name}.`, {
      type: 'buttons', buttons: [{ type: 'reply', id: "1", title: "Add Protein" }, { type: 'reply', id: "2", title: "Checkout" }]
    }, { type: 'buttons', buttons: [{ id: "1", title: "Add Protein" }, { id: "2", title: "Checkout" }] });
  } else {
    await showCartSummary(from, cart);
  }
}

async function handleProteinLoop(from, msg) {
  if (msg==='1') {
    await db.ref(`users/${from}/step`).set('protein_select');
    const items = MENU_CATEGORIES['PROTEINS'].map(i=>({id:i.id.toString(),title:i.name,description:`₦${i.reg}`}));
    await sendSmart(from, "🍗 Proteins", {
      type: 'list', list: { button: "Choose", sections: [{ title: "Pick", rows: items }] }
    }, { type: 'list', items });
  } else {
    const user = (await db.ref(`users/${from}`).once('value')).val();
    await showCartSummary(from, user.cart);
  }
}

async function handleProteinSelect(from, id) {
  const item = MENU_CATEGORIES['PROTEINS'].find(i=>i.id===id);
  if (!item) return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid." });
  await db.ref(`users/${from}`).update({ step: 'protein_size', selected_item: item });
  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('protein_qty');
    await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Price: ${formatCurrency(item.reg)}\n\nHow many?` });
  } else {
    await sendSmart(from, `*${item.name}*`, {
      type: 'buttons', buttons: [{ type: 'reply', id: "1", title: "Regular" }, { type: 'reply', id: "2", title: "Extra" }]
    }, { type: 'buttons', buttons: [{ id: "1", title: "Regular" }, { id: "2", title: "Extra" }] });
  }
}

async function handleProteinSize(from, choice) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const item = user.selected_item;
  const size = choice===1?'reg':'ext';
  await db.ref(`users/${from}`).update({ step: 'protein_qty', selected_item_price: item[size], selected_size: choice===1?'Regular':'Extra' });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `How many?` });
}

async function handleProteinQty(from, qty) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const item = user.selected_item;
  const newItem = { name: item.name, price: user.selected_item_price, qty, size: user.selected_size, type: 'protein' };
  const cart = user.cart||[]; cart.push(newItem);
  await db.ref(`users/${from}`).update({ cart, step: 'protein_loop' });
  await sendSmart(from, `✅ Added ${qty}x ${item.name}.`, {
    type: 'buttons', buttons: [{ type: 'reply', id: "1", title: "More" }, { type: 'reply', id: "2", title: "Checkout" }]
  }, { type: 'buttons', buttons: [{ id: "1", title: "More" }, { id: "2", title: "Checkout" }] });
}

async function showCartSummary(from, cart) {
  let sub=0, txt=`🧾 *Cart*\n\n`;
  cart.forEach(c=>{ const t=c.price*c.qty; sub+=t; txt+=`${c.name} x${c.qty} = ${formatCurrency(t)}\n`; });
  txt+=`\nSubtotal: ${formatCurrency(sub)}`;
  await db.ref(`users/${from}`).update({ step: 'add_more_or_checkout', cart_subtotal: sub });
  await sendSmart(from, txt, {
    type: 'buttons', buttons: [{ type: 'reply', id: "1", title: "Add Food" }, { type: 'reply', id: "2", title: "Delivery" }]
  }, { type: 'buttons', buttons: [{ id: "1", title: "Add Food" }, { id: "2", title: "Delivery" }] });
}

// --- ERRAND HANDLERS ---
async function handleErrandType(from, type) {
  const map={1:"MARKET",2:"PICK_UP",3:"PHARMACY",4:"TASK"};
  if(!map[type]) return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Invalid." });
  await db.ref(`users/${from}`).update({ step: [1,3].includes(type)?'errand_details':'errand_location', errand_type: map[type] });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: [1,3].includes(type)?"List items: Item Price":"Describe task:" });
}

async function handleErrandDetails(from, text) {
  const parts=text.split(','); let items=[], budget=0;
  parts.forEach(p=>{ const sp=p.trim().split(' '); if(sp.length>=2){ const p=parseInt(sp.pop()); const n=sp.join(' '); if(!isNaN(p)){items.push({name:n,price:p}); budget+=p;} }});
  if(items.length===0) return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Format error." });
  await db.ref(`users/${from}`).update({ step: 'errand_location', errand_items: items, shopping_budget: budget });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Saved. Total: ${formatCurrency(budget)}.\n\n📍 Pickup?` });
}

async function handleErrandLocation(from, text) {
  await db.ref(`users/${from}`).update({ step: 'delivery_location', pickup_location: text });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "📍 Delivery location?" });
}

async function handleDeliveryLocation(from, text) {
  await db.ref(`users/${from}`).update({ step: 'phone_number', delivery_location: text });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "📞 Phone?" });
}

async function handlePhoneNumber(from, text) {
  const user = (await db.ref(`users/${from}`).once('value')).val();
  const total = (user.cart_subtotal||user.shopping_budget||0) + DELIVERY_FEE + (user.needs_shopping?SHOPPING_FEE:0);
  await db.ref(`users/${from}`).update({ phone: text, step: 'confirm_order', final_total: total });
  await sendSmart(from, `Total: ${formatCurrency(total)}\nPay to Monie Point 70437763589.`, {
    type: 'buttons', buttons: [{ type: 'reply', id: "confirm", title: "CONFIRM" }]
  }, { type: 'buttons', buttons: [{ id: "confirm", title: "CONFIRM" }] });
}

async function handleFinalConfirm(from, msg) {
  if(msg!=='confirm') return await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: "Click Confirm." });
  const user = (await db.ref(`users/${from}`).once('value')).val();
  await db.ref(`users/${from}`).update({ step: 'awaiting_payment' });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Send screenshot for ${formatCurrency(user.final_total)}.` });
}

async function createOrderInDB(from, user) {
  const id = generateId();
  await db.ref(`orders/${id}`).set({
    id, customer: from, customer_phone: user.phone, type: user.order_type, status: 'pending_payment', total: user.final_total,
    delivery_loc: user.delivery_location, pickup_loc: user.pickup_location||VENDOR_NAME,
    details: user.order_type==='food'?user.cart:user.errand_items, timestamp: admin.database.ServerValue.TIMESTAMP
  });
  await db.ref(`users/${from}`).update({ step: 'new' });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: from, body: `Order #${id} received.` });
  try {
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: ADMIN_PHONE.startsWith('whatsapp:')?ADMIN_PHONE:`whatsapp:${ADMIN_PHONE}`,
      body: `New Order #${id}\nTotal: ${formatCurrency(user.final_total)}`
    });
  } catch(e){}
}

async function approveOrder(id) {
  const snap = await db.ref(`orders/${id}`).once('value'); const order=snap.val();
  await db.ref(`orders/${id}/status`).set('seeking_rider');
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: order.customer, body: `Payment Verified. Order #${id}` });
  broadcastToRiders(id, order);
}

async function rejectOrder(id) {
  const snap = await db.ref(`orders/${id}`).once('value'); const order=snap.val();
  await db.ref(`orders/${id}/status`).set('rejected');
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: order.customer, body: `Payment Failed. Order #${id}` });
}

async function acceptOrder(from, id) {
  const snap = await db.ref(`orders/${id}`).once('value'); const order=snap.val();
  if(order.status!=='seeking_rider') return;
  const rider=(await db.ref(`riders/${from}`).once('value')).val();
  await db.ref(`orders/${id}`).update({ status:'rider_accepted', rider_phone: from });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: ADMIN_PHONE, body: `Rider Accepted #${id}: ${rider.name}` });
  await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: order.customer, body: `Rider Assigned #${id}: ${rider.name}` });
}

async function updateOrderStatus(id, status, from) {
  const snap = await db.ref(`orders/${id}`).once('value'); const order=snap.val();
  if(order.rider_phone!==from) return;
  await db.ref(`orders/${id}/status`).set(status);
  if(status==='delivered') await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: order.customer, body: `Delivered #${id}` });
}

async function broadcastToRiders(id, order) {
  const ridersSnap = await db.ref('riders').orderByChild('status').equalTo('on_duty').once('value'); const riders=ridersSnap.val();
  const msg=`Job #${id}\nFee: ${formatCurrency(DELIVERY_FEE)}\nReply: ACCEPT ${id}`;
  if(riders) Object.keys(riders).forEach(k=>{
    if(riders[k].phone) client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: riders[k].phone, body: msg }).catch(e=>console.log(e));
  });
}

app.get('/', (req, res) => res.send('Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
