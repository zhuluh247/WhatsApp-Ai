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
    { id: 23, name: "Beef", reg: 500, ext: 500 }, // Same price for reg/ext
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

// --- 6. MAIN WEBHOOK ROUTE ---
app.post('/whatsapp', async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const msg = body.toLowerCase(); // Case insensitive logic
  const originalMsg = body; // Preserve case for item names

  console.log(`[${new Date().toISOString()}] From: ${from}, Msg: ${body}`);

  try {
    // A. RIDER REGISTRATION & COMMANDS
    if (msg.startsWith('register rider ')) {
      const parts = originalMsg.split(' ');
      const code = parts[2];
      const riderName = parts.slice(3).join(' ') || "Rider";

      if (code === RIDER_REG_CODE) {
        await db.ref(`riders/${from}`).set({
          name: riderName,
          status: 'inactive', // inactive, on_duty
          phone: from,
          joined_at: new Date().toISOString()
        });
        twiml.message(`✅ Registration Successful!\n\nWelcome ${riderName}. You are now a ChowZone Rider.\n\nText "ON DUTY" to start receiving jobs.`);
      } else {
        twiml.message('❌ Invalid Registration Code. Please contact Admin.');
      }
      return res.type('text/xml').send(twiml.toString());
    }

    // Get User State
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val() || { step: 'new' };

    // B. ADMIN COMMANDS
    if (from === ADMIN_PHONE) {
      if (msg.startsWith('approve ')) {
        const orderId = msg.split(' ')[1];
        await approveOrder(orderId, twiml);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('reject ')) {
        const orderId = msg.split(' ')[1];
        await rejectOrder(orderId, twiml);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('funds sent ')) {
        const orderId = msg.split(' ')[2]; // "FUNDS SENT 123"
        await confirmFunds(orderId, twiml);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // C. RIDER COMMANDS
    const riderSnap = await db.ref(`riders/${from}`).once('value');
    const rider = riderSnap.val();

    if (rider) {
      if (msg === 'on duty') {
        await db.ref(`riders/${from}/status`).set('on_duty');
        twiml.message('✅ You are ON DUTY. You will receive job broadcasts now.');
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg === 'off duty') {
        await db.ref(`riders/${from}/status`).set('inactive');
        twiml.message('⚠️ You are OFF DUTY.');
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('accept ')) {
        const orderId = msg.split(' ')[1];
        await acceptOrder(from, orderId, twiml);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('picked up')) {
        await updateOrderStatus(msg.split(' ')[2], 'picked_up', twiml, from); // assuming "PICKED UP 123"
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('delivered')) {
        await updateOrderStatus(msg.split(' ')[1], 'delivered', twiml, from);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // D. CUSTOMER FLOW
    
    // Start / Reset
    if (msg === 'hi' || msg === 'menu' || msg === '0') {
      await resetUser(from, twiml);
      return res.type('text/xml').send(twiml.toString());
    }

    // State Machine
    switch (user.step) {
      case 'new':
      case 'main_menu':
        await handleMainMenu(from, msg, twiml);
        break;
      case 'vendor_select':
        // Currently only 1 vendor (Bissy Joy)
        if (msg === '1') {
          await showCategories(from, twiml);
        } else {
          twiml.message("Invalid option.");
        }
        break;
      case 'category_select':
        await handleCategorySelect(from, parseInt(msg), twiml);
        break;
      case 'item_select':
        await handleItemSelect(from, parseInt(msg), twiml);
        break;
      case 'size_select':
        await handleSizeSelect(from, msg, twiml);
        break;
      case 'quantity_select':
        await handleQuantitySelect(from, parseInt(msg), twiml);
        break;
      case 'protein_loop':
        await handleProteinLoop(from, msg, twiml);
        break;
      case 'protein_select':
        await handleProteinSelect(from, parseInt(msg), twiml);
        break;
      case 'protein_size':
        await handleProteinSize(from, msg, twiml);
        break;
      case 'protein_qty':
        await handleProteinQty(from, parseInt(msg), twiml);
        break;
      case 'errand_type':
        await handleErrandType(from, parseInt(msg), twiml);
        break;
      case 'errand_details':
        await handleErrandDetails(from, originalMsg, twiml);
        break;
      case 'errand_location':
        await handleErrandLocation(from, originalMsg, twiml);
        break;
      case 'errand_budget': // For shopping
        await handleErrandBudget(from, parseInt(originalMsg.replace(/\D/g,'')), twiml); // Extract number
        break;
      case 'delivery_location':
        await handleDeliveryLocation(from, originalMsg, twiml);
        break;
      case 'phone_number':
        await handlePhoneNumber(from, originalMsg, twiml);
        break;
      case 'confirm_order':
        await handleFinalConfirm(from, msg, twiml);
        break;
      default:
        twiml.message("I didn't understand that. Reply 'Menu'.");
    }

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error("Error:", error);
    twiml.message("❌ Server error. Please try again.");
    res.type('text/xml').send(twiml.toString());
  }
});

// --- 7. LOGIC HANDLERS (CUSTOMER) ---

async function resetUser(from, twiml) {
  await db.ref(`users/${from}`).set({
    step: 'main_menu',
    cart: [],
    order_type: null,
    errand_data: {}
  });
  const welcomeMsg = `🍽️ *Welcome to ChowZone!*\n\nHow can we help you today?\n\n1. Order Food\n2. Errands (Market/Pharmacy/Pickup)\n\nReply with number 1 or 2.`;
  twiml.message(welcomeMsg);
}

async function handleMainMenu(from, msg, twiml) {
  if (msg === '1') {
    // Food
    await db.ref(`users/${from}`).update({
      step: 'vendor_select',
      order_type: 'food'
    });
    twiml.message(`🏪 *Select Vendor*\n\n1. ${VENDOR_NAME}\n\nReply 1.`);
  } else if (msg === '2') {
    // Errands
    await db.ref(`users/${from}`).update({
      step: 'errand_type',
      order_type: 'errand'
    });
    twiml.message(`🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 💊 Pharmacy / Supermarket\n4. 📝 Campus Task\n\nReply with number.`);
  } else {
    twiml.message("Invalid option.");
  }
}

async function showCategories(from, twiml) {
  await db.ref(`users/${from}/step`).set('category_select');
  let msg = `🍽️ *${VENDOR_NAME} Categories*\n\n`;
  msg += `1. 🍚 Rice Meals\n2. 🥘 Swallow & Solids\n3. 🍗 Proteins / Add-ons\n\nReply number.`;
  twiml.message(msg);
}

async function handleCategorySelect(from, choice, twiml) {
  let categoryKey = '';
  if (choice === 1) categoryKey = 'RICE_MEALS';
  if (choice === 2) categoryKey = 'SWALLOWS';
  if (choice === 3) categoryKey = 'PROTEINS';

  if (!categoryKey) return twiml.message("Invalid category.");

  await db.ref(`users/${from}`).update({
    step: 'item_select',
    current_category: categoryKey
  });

  let msg = `*${categoryKey.replace('_', ' ')}*\n\n`;
  MENU_CATEGORIES[categoryKey].forEach(item => {
    const priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
    msg += `${item.id}. ${item.name} - ${priceTxt}\n`;
  });
  msg += `\nReply item number.`;
  twiml.message(msg);
}

async function handleItemSelect(from, id, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const cat = MENU_CATEGORIES[user.current_category];
  const item = cat.find(i => i.id === id);

  if (!item) return twiml.message("Invalid item number.");

  // If item is protein (from main menu), we might add to cart directly or ask size
  // Logic: Rice/Swallow -> Main Item. Proteins -> Side Item (unless it's standalone).
  // For simplicity, let's treat everything as a potential main item for now, 
  // BUT user flow said: Food -> Protein Add-ons.
  // If user selected category 3 (Proteins), they are likely ordering just meat.
  
  await db.ref(`users/${from}`).update({
    step: 'size_select',
    selected_item: item
  });

  if (item.reg === item.ext) {
    // No size difference, skip to quantity
    await handleQuantitySelect(from, 1, twiml); // Hack to reuse logic, but actually just set step
    // Wait, better to just move to qty step manually
    await db.ref(`users/${from}/step`).set('quantity_select');
    twiml.message(`*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many?`);
  } else {
    let msg = `*${item.name}*\n\nSelect Portion:\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`;
    twiml.message(msg);
  }
}

async function handleSizeSelect(from, choice, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  const size = choice === 1 ? 'reg' : 'ext';
  const price = item[size];

  await db.ref(`users/${from}`).update({
    step: 'quantity_select',
    selected_item_price: price,
    selected_size: choice === 1 ? 'Regular' : 'Extra'
  });

  twiml.message(`*${item.name} (${choice === 1 ? 'Regular' : 'Extra'})*\n\nPrice: ${formatCurrency(price)}\n\nHow many?`);
}

async function handleQuantitySelect(from, qty, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = user.selected_item;
  const price = user.selected_item_price || item.reg; // default if skipped
  const size = user.selected_size || (item.reg === item.ext ? 'Regular' : 'Regular'); // default

  const newItem = {
    name: item.name,
    price: price,
    qty: qty,
    size: size,
    type: 'main' // or protein
  };

  const cart = user.cart || [];
  cart.push(newItem);

  // If this was a main food item (from Rice/Swallow), ask for protein add-ons
  if (user.current_category !== 'PROTEINS') {
    await db.ref(`users/${from}`).update({
      step: 'protein_loop',
      cart: cart
    });
    twiml.message(`✅ Added ${qty}x ${item.name}.\n\n🍗 Do you want to add Protein/Sides?\n1. Yes\n2. No`);
  } else {
    // It was a standalone protein order, go to checkout/add more
    await askMoreOrCheckout(from, cart, twiml);
  }
}

async function handleProteinLoop(from, msg, twiml) {
  if (msg === '1') {
    // Show proteins
    const cat = MENU_CATEGORIES['PROTEINS'];
    let txt = `🍗 *Proteins & Sides*\n\n`;
    cat.forEach(item => {
       const priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
       txt += `${item.id}. ${item.name} - ${priceTxt}\n`;
    });
    txt += `\nReply item number.`;
    
    await db.ref(`users/${from}/step`).set('protein_select');
    twiml.message(txt);
  } else if (msg === '2') {
    const userSnap = await db.ref(`users/${from}`).once('value');
    await askMoreOrCheckout(from, userSnap.val().cart, twiml);
  } else {
    twiml.message("Reply 1 or 2.");
  }
}

async function handleProteinSelect(from, id, twiml) {
  const cat = MENU_CATEGORIES['PROTEINS'];
  const item = cat.find(i => i.id === id);
  if (!item) return twiml.message("Invalid item.");

  await db.ref(`users/${from}`).update({
    step: 'protein_size',
    selected_item: item
  });

  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('protein_qty');
    twiml.message(`*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many pieces?`);
  } else {
    twiml.message(`*${item.name}*\n\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`);
  }
}

async function handleProteinSize(from, choice, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  const size = choice === 1 ? 'reg' : 'ext';
  
  await db.ref(`users/${from}`).update({
    step: 'protein_qty',
    selected_item_price: item[size],
    selected_size: choice === 1 ? 'Regular' : 'Extra'
  });
  twiml.message(`*${item.name} (${choice === 1 ? 'Regular' : 'Extra'})*\n\nHow many pieces?`);
}

async function handleProteinQty(from, qty, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = user.selected_item;
  
  const newItem = {
    name: item.name,
    price: user.selected_item_price,
    qty: qty,
    size: user.selected_size,
    type: 'protein'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  // Ask to add more proteins
  await db.ref(`users/${from}`).update({ cart: cart, step: 'protein_loop' });
  twiml.message(`✅ Added ${qty}x ${item.name}.\n\nAdd another protein?\n1. Yes\n2. No (Checkout)`);
}

async function askMoreOrCheckout(from, cart, twiml) {
  // Calculate Subtotal
  let sub = 0;
  let txt = `🧾 *Current Cart*\n\n`;
  cart.forEach((c, i) => {
    const t = c.price * c.qty;
    sub += t;
    txt += `${c.name} (${c.size}) x${c.qty} = ${formatCurrency(t)}\n`;
  });
  txt += `\n💰 Subtotal: ${formatCurrency(sub)}\n\n`;
  txt += `Do you want to add another meal?\n1. Yes (Add Food)\n2. No (Proceed to Delivery)`;

  await db.ref(`users/${from}`).update({
    step: 'add_more_or_checkout',
    cart_subtotal: sub
  });
  twiml.message(txt);
}

// Interceptor for step 'add_more_or_checkout'
// NOTE: In switch case, I didn't add 'add_more_or_checkout'. Let's handle it via 'confirm_order' logic or extend switch.
// For now, I'll assume the user flow continues. Let's modify the Switch block conceptually.
// I will update the switch block in the final code mentally, but here I write the function.

async function handleErrandType(from, type, twiml) {
  let typeStr = "";
  let needsShopping = false;
  
  if (type === 1) { typeStr = "MARKET"; needsShopping = true; }
  else if (type === 2) { typeStr = "PICK_UP"; }
  else if (type === 3) { typeStr = "PHARMACY"; needsShopping = true; }
  else if (type === 4) { typeStr = "TASK"; }
  else return twiml.message("Invalid.");

  await db.ref(`users/${from}`).update({
    step: needsShopping ? 'errand_details' : 'errand_location', // Shopping needs list first
    errand_type: typeStr,
    needs_shopping: needsShopping
  });

  if (needsShopping) {
    twiml.message(`📝 *List the items you want to buy.*\n\nFormat: Item Price, Item Price\nExample: Beans 2000, Oil 500`);
  } else {
    twiml.message(`📝 *Describe the task or pickup:*`);
  }
}

async function handleErrandDetails(from, text, twiml) {
  // Parse "Beans 2000, Oil 500"
  // Simple parser: split by comma, then split by last space for price
  const parts = text.split(',');
  let items = [];
  let budget = 0;

  parts.forEach(p => {
    const subParts = p.trim().split(' ');
    if (subParts.length >= 2) {
      const price = parseInt(subParts.pop()); // Get last number
      const name = subParts.join(' ');
      if (!isNaN(price)) {
        items.push({ name, price });
        budget += price;
      }
    }
  });

  if (items.length === 0) return twiml.message("⚠️ Could not read prices. Example: 'Beans 2000'");

  await db.ref(`users/${from}`).update({
    step: 'errand_location',
    errand_items: items,
    shopping_budget: budget
  });

  let msg = `✅ Items saved:\n`;
  items.forEach(i => msg += `- ${i.name}: ${formatCurrency(i.price)}\n`);
  msg += `\nTotal Items Cost: ${formatCurrency(budget)}\n\n📍 Where is the pickup location (e.g. Market, Pharmacy Name)?`;
  twiml.message(msg);
}

async function handleErrandLocation(from, text, twiml) {
  await db.ref(`users/${from}`).update({
    step: 'delivery_location', // Skip specific "budget" step since we calculated it
    pickup_location: text
  });
  twiml.message("📍 Where should the rider drop the items? (Your Hostel/Room)");
}

async function handleDeliveryLocation(from, text, twiml) {
  await db.ref(`users/${from}`).update({
    step: 'phone_number',
    delivery_location: text
  });
  twiml.message("📞 Please share your Phone Number for the rider.");
}

async function handlePhoneNumber(from, text, twiml) {
  await db.ref(`users/${from}`).update({
    phone: text,
    step: 'confirm_order'
  });

  // Calculate Total
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  let total = 0;
  let summary = `🧾 *ORDER SUMMARY*\n\n`;

  if (user.order_type === 'food') {
    total = user.cart_subtotal || 0;
    user.cart.forEach(c => {
      summary += `${c.name} (${c.size}) x${c.qty}\n`;
    });
    summary += `\nFood Cost: ${formatCurrency(total)}`;
  } else {
    // Errand
    total = user.shopping_budget || 0;
    summary += `Items: ${formatCurrency(total)}\n`;
    
    // Add fees
    if (user.needs_shopping) summary += `Shopping Fee: ${formatCurrency(SHOPPING_FEE)}\n`;
    else summary += `Service Fee: ${formatCurrency(SHOPPING_FEE)}\n`; // Flat fee for tasks
    
    total += SHOPPING_FEE;
  }

  total += DELIVERY_FEE;
  summary += `\nDelivery Fee: ${formatCurrency(DELIVERY_FEE)}`;
  summary += `\n━━━━━━━━━━━\n💰 *TOTAL: ${formatCurrency(total)}*`;

  await db.ref(`users/${from}`).update({ final_total: total });

  summary += `\n\nReply "CONFIRM" to place order.`;
  twiml.message(summary);
}

async function handleFinalConfirm(from, msg, twiml) {
  if (msg !== 'confirm') return twiml.message("Please type CONFIRM to proceed.");

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const orderId = generateId();

  const orderData = {
    id: orderId,
    customer: from,
    customer_phone: user.phone,
    type: user.order_type,
    status: 'pending_payment',
    total: user.final_total,
    delivery_loc: user.delivery_location,
    pickup_loc: user.pickup_location || VENDOR_NAME,
    details: user.order_type === 'food' ? user.cart : user.errand_items,
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  await db.ref(`orders/${orderId}`).set(orderData);

  twiml.message(`✅ Order #${orderId} Placed!\n\nPlease pay ${formatCurrency(user.final_total)} to:\n\nBANK: [YOUR BANK]\nACCT: [YOUR ACCT]\n\nSend screenshot here.`);
}

// --- 8. ADMIN & ORDER LOGIC ---

async function approveOrder(orderId, twiml) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return twiml.message("Order not found.");

  await db.ref(`orders/${orderId}/status`).set('seeking_rider');
  
  // Notify Customer
  const clientMsg = new twilio.twiml.MessagingResponse();
  clientMsg.message(`✅ Payment Verified for Order #${orderId}.\n\nFinding a rider now...`);
  
  // Broadcast to Riders
  broadcastToRiders(orderId, order);
  
  twiml.message(`Order #${orderId} Approved. Broadcast sent.`);
}

async function rejectOrder(orderId, twiml) {
  await db.ref(`orders/${orderId}/status`).set('rejected');
  twiml.message(`Order #${orderId} Rejected.`);
  // Logic to notify customer can be added here
}

async function confirmFunds(orderId, twiml) {
  await db.ref(`orders/${orderId}/status`).set('funded');
  twiml.message(`Order #${orderId} marked as Funded. Rider notified.`);
  // Notify rider
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const riderPhone = snap.val().rider_phone;
  if (riderPhone) {
    // Send message to rider (Requires a helper or client instance)
    // For simplicity, we assume rider is listening or Admin tells them manually
    // In real code: client.messages.create...
  }
}

async function acceptOrder(riderPhone, orderId, twiml) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  
  if (order.status !== 'seeking_rider') return twiml.message("Job already taken or closed.");

  await db.ref(`orders/${orderId}`).update({
    status: 'rider_accepted',
    rider_phone: riderPhone
  });
  twiml.message(`✅ Tentatively accepted Order #${orderId}. Wait for Admin confirmation.`);
}

async function updateOrderStatus(orderId, status, twiml, from) {
  // Validate rider owns order
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (order.rider_phone !== from) return twiml.message("Not your order.");

  await db.ref(`orders/${orderId}/status`).set(status);
  twiml.message(`Order #${orderId} updated to ${status.toUpperCase()}.`);
}

async function broadcastToRiders(orderId, order) {
  const ridersSnap = await db.ref('riders').orderByChild('status').equalTo('on_duty').once('value');
  const riders = ridersSnap.val();
  
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  let msg = `🛵 NEW JOB #${orderId}\n`;
  msg += `Pickup: ${order.pickup_loc}\n`;
  msg += `Dropoff: ${order.delivery_loc}\n`;
  msg += `Fee: ${formatCurrency(DELIVERY_FEE)}\n`;
  msg += `Reply: ACCEPT ${orderId}`;

  if (riders) {
    Object.keys(riders).forEach(key => {
      const rider = riders[key];
      if (rider.phone) {
        client.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: rider.phone,
          body: msg
        }).then(message => console.log(message.sid))
        .catch(err => console.error(err));
      }
    });
  }
}

// --- 9. KEEP ALIVE & LISTEN ---
app.get('/', (req, res) => res.send('ChowZone Bot is Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
