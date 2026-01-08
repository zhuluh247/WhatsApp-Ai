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
const SUPPORT_PHONE = "+2349138765380"; // Manual Support Number

// --- 4. MENU DATA (Bissy Joy Eatery) ---
const VENDOR_NAME = "Bissy Joy Eatery";
const VENDOR_ADDRESS = "Bissy Joy Eatery Kitchen";
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

// --- 6. MAIN WEBHOOK ROUTE ---
app.post('/whatsapp', async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const msg = body.toLowerCase(); 
  const originalMsg = body; 
  const numMedia = parseInt(req.body.NumMedia) || 0;

  console.log(`[${new Date().toISOString()}] From: ${from}, Msg: ${body}, Media: ${numMedia}`);

  try {
    // --- A. SUPPORT KEYWORDS ---
    if (msg.includes('support') || msg.includes('help') || msg.includes('agent') || msg.includes('problem')) {
        twiml.message(`🆘 *Customer Support*\n\nIf you are having trouble with the bot, please contact our agent directly:\n\n📞 WhatsApp: ${SUPPORT_PHONE}`);
        return res.type('text/xml').send(twiml.toString());
    }

    // --- B. MEDIA HANDLING (Payment Screenshots) ---
    if (numMedia > 0) {
      const userSnap = await db.ref(`users/${from}`).once('value');
      const user = userSnap.val();
      const mediaUrl = req.body.MediaUrl0; // Capture the image URL
      
      if (user && user.step === 'awaiting_payment') {
        await createOrderInDB(from, user, twiml, mediaUrl);
        return res.type('text/xml').send(twiml.toString());
      } else {
        twiml.message("Please complete the text steps first. Reply 'Menu' to restart.");
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- C. RIDER REGISTRATION ---
    if (msg.startsWith('register rider ')) {
      const parts = originalMsg.split(' ');
      const code = parts[2];
      const riderName = parts.slice(3).join(' ') || "Rider";

      if (code === RIDER_REG_CODE) {
        await db.ref(`riders/${from}`).set({
          name: riderName,
          status: 'inactive',
          phone: from,
          joined_at: new Date().toISOString()
        });
        twiml.message(`✅ Registration Successful!\n\nWelcome ${riderName}. Text "ON DUTY" to start.`);
      } else {
        twiml.message('❌ Invalid Registration Code.');
      }
      return res.type('text/xml').send(twiml.toString());
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val() || { step: 'new' };

    // --- GLOBAL CANCEL COMMAND ---
    if ((msg === 'cancel' || msg === '0') && user.step !== 'main_menu' && user.step !== 'new') {
        await resetUser(from, twiml);
        return res.type('text/xml').send(twiml.toString());
    }

    // --- D. ADMIN COMMANDS ---
    if (from === ADMIN_PHONE) {
      if (msg.startsWith('approve ')) {
        const orderId = msg.split(' ')[1];
        await approveOrder(orderId);
        twiml.message(`Order #${orderId} Approved.`);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('reject ')) {
        const orderId = msg.split(' ')[1];
        await rejectOrder(orderId);
        twiml.message(`Order #${orderId} Rejected.`);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- E. RIDER COMMANDS ---
    const riderSnap = await db.ref(`riders/${from}`).once('value');
    const rider = riderSnap.val();

    if (rider) {
      if (msg === 'on duty') {
        await db.ref(`riders/${from}/status`).set('on_duty');
        twiml.message('✅ You are ON DUTY.');
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
      if (msg.startsWith('delivered')) {
        await updateOrderStatus(msg.split(' ')[1], 'delivered', twiml, from);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- F. CUSTOMER FLOW STATE MACHINE ---
    if (msg === 'hi' || msg === 'menu' || msg === 'start') {
      await resetUser(from, twiml);
      return res.type('text/xml').send(twiml.toString());
    }

    switch (user.step) {
      case 'new':
      case 'main_menu':
        await handleMainMenu(from, msg, twiml);
        break;
      case 'vendor_select':
        if (msg === '1') await showCategories(from, twiml);
        else twiml.message("Invalid option. Reply 1.");
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
        await handleQuantitySelect(from, msg, twiml);
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
        await handleProteinQty(from, msg, twiml);
        break;
      case 'add_more_or_checkout':
        if (msg === '1') {
           await showCategories(from, twiml); 
        } else if (msg === '2') {
           // FIX: Set state and ask question, don't call handler directly
           await db.ref(`users/${from}`).update({ step: 'customer_name' });
           twiml.message("📝 Please provide your Full Name.");
        } else {
           twiml.message("Reply 1 or 2.");
        }
        break;
      case 'errand_type':
        await handleErrandType(from, parseInt(msg), twiml);
        break;
      case 'errand_details':
        await handleErrandDetails(from, originalMsg, twiml);
        break;
      case 'customer_name':
        await handleCustomerName(from, originalMsg, twiml);
        break;
      case 'customer_phone':
        await handleCustomerPhone(from, originalMsg, twiml);
        break;
      case 'pickup_location':
        await handlePickupLocation(from, originalMsg, twiml);
        break;
      case 'delivery_location':
        await handleDeliveryLocation(from, originalMsg, twiml);
        break;
      case 'confirm_order':
        await handleFinalConfirm(from, msg, twiml);
        break;
      case 'rate_rider':
        await handleRateRider(from, msg, twiml);
        break;
      case 'rate_service':
        await handleRateService(from, msg, twiml);
        break;
      default:
        twiml.message("I didn't understand that. Reply 'Menu' to restart.");
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
  const welcomeMsg = `🍽️ *Welcome to ChowZone!*\n\nHow can we help you today?\n\n1. Order Food\n2. Errands (Market/Pharmacy/Pickup)\n\nReply with number 1 or 2.\n(Text 'Cancel' anytime to restart)`;
  twiml.message(welcomeMsg);
}

async function handleMainMenu(from, msg, twiml) {
  if (msg === '1') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_select',
      order_type: 'food'
    });
    twiml.message(`🏪 *Select Vendor*\n\n1. ${VENDOR_NAME}\n\nReply 1.`);
  } else if (msg === '2') {
    await db.ref(`users/${from}`).update({
      step: 'errand_type',
      order_type: 'errand'
    });
    twiml.message(`🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 💊 Pharmacy / Supermarket\n4. 📝 Campus Task\n\nReply with number.`);
  } else {
    twiml.message("Invalid option. Reply 1 or 2.");
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

  if (!categoryKey) return twiml.message("Invalid category. Reply 1, 2, or 3.");

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
  
  await db.ref(`users/${from}`).update({
    step: 'size_select',
    selected_item: item
  });

  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('quantity_select');
    twiml.message(`*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many? (Enter number)`);
  } else {
    let msg = `*${item.name}*\n\nSelect Portion:\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`;
    twiml.message(msg);
  }
}

async function handleSizeSelect(from, msg, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  
  if (msg !== '1' && msg !== '2') {
      return twiml.message("Invalid choice. Reply 1 for Regular or 2 for Extra.");
  }

  const size = msg === '1' ? 'reg' : 'ext';
  const price = item[size];
  const label = msg === '1' ? 'Regular' : 'Extra';

  await db.ref(`users/${from}`).update({
    step: 'quantity_select',
    selected_item_price: price,
    selected_size: label
  });

  twiml.message(`*${item.name} (${label})*\n\nPrice: ${formatCurrency(price)}\n\nHow many? (Enter number)`);
}

async function handleQuantitySelect(from, msg, twiml) {
  const qty = parseInt(msg);
  if (isNaN(qty) || qty <= 0) {
    return twiml.message("⚠️ Please enter a valid number (e.g., 2).");
  }

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = userSnap.val().selected_item;
  const price = user.selected_item_price || item.reg;
  const size = user.selected_size || (item.reg === item.ext ? 'Regular' : 'Regular');

  const newItem = {
    name: item.name,
    price: price,
    qty: qty,
    size: size,
    type: user.current_category === 'PROTEINS' ? 'protein' : 'main'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  if (user.current_category !== 'PROTEINS') {
    await db.ref(`users/${from}`).update({
      step: 'protein_loop',
      cart: cart
    });
    twiml.message(`✅ Added ${qty}x ${item.name}.\n\n🍗 Do you want to add Protein/Sides?\n1. Yes\n2. No`);
  } else {
    await showCartSummary(from, cart, twiml);
  }
}

async function handleProteinLoop(from, msg, twiml) {
  if (msg === '1') {
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
    await showCartSummary(from, userSnap.val().cart, twiml);
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

async function handleProteinSize(from, msg, twiml) {
  if (msg !== '1' && msg !== '2') return twiml.message("Reply 1 or 2.");

  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  const size = msg === '1' ? 'reg' : 'ext';
  
  await db.ref(`users/${from}`).update({
    step: 'protein_qty',
    selected_item_price: item[size],
    selected_size: msg === '1' ? 'Regular' : 'Extra'
  });
  twiml.message(`*${item.name} (${msg === '1' ? 'Regular' : 'Extra'})*\n\nHow many pieces?`);
}

async function handleProteinQty(from, msg, twiml) {
    const qty = parseInt(msg);
    if (isNaN(qty) || qty <= 0) return twiml.message("⚠️ Please enter a valid number.");

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = userSnap.val().selected_item;
  
  const newItem = {
    name: item.name,
    price: user.selected_item_price,
    qty: qty,
    size: user.selected_size,
    type: 'protein'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  await db.ref(`users/${from}`).update({ cart: cart, step: 'protein_loop' });
  twiml.message(`✅ Added ${qty}x ${item.name}.\n\nAdd another protein?\n1. Yes\n2. No (Checkout)`);
}

async function showCartSummary(from, cart, twiml) {
  let sub = 0;
  let txt = `🧾 *Current Cart*\n\n`;
  cart.forEach((c) => {
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

// --- ERRAND HANDLERS ---

async function handleErrandType(from, type, twiml) {
  let typeStr = "";
  let needsShopping = false;
  
  if (type === 1) { typeStr = "MARKET"; needsShopping = true; }
  else if (type === 2) { typeStr = "PICK_UP"; }
  else if (type === 3) { typeStr = "PHARMACY"; needsShopping = true; }
  else if (type === 4) { typeStr = "TASK"; }
  else return twiml.message("Invalid selection.");

  await db.ref(`users/${from}`).update({
    step: needsShopping ? 'errand_details' : 'customer_name',
    errand_type: typeStr,
    needs_shopping: needsShopping
  });

  if (needsShopping) {
    twiml.message(`📝 *List the items you want to buy.*\n\nFormat: Item Price, Item Price\nExample: Beans 2000, Oil 500`);
  } else {
    twiml.message(`📝 *Describe the task or pickup details:*`);
  }
}

async function handleErrandDetails(from, text, twiml) {
  const parts = text.split(',');
  let items = [];
  let budget = 0;

  parts.forEach(p => {
    const subParts = p.trim().split(' ');
    if (subParts.length >= 2) {
      const price = parseInt(subParts.pop());
      const name = subParts.join(' ');
      if (!isNaN(price)) {
        items.push({ name, price });
        budget += price;
      }
    }
  });

  if (items.length === 0) return twiml.message("⚠️ Could not read prices. Example: 'Beans 2000'");

  await db.ref(`users/${from}`).update({
    step: 'customer_name',
    errand_items: items,
    shopping_budget: budget,
    errand_description: null
  });

  let msg = `✅ Items saved:\n`;
  items.forEach(i => msg += `- ${i.name}: ${formatCurrency(i.price)}\n`);
  msg += `\nTotal Items Cost: ${formatCurrency(budget)}\n\n📝 Next, please provide your Name.`;
  twiml.message(msg);
}

// --- NEW CHECKOUT FLOW HANDLERS ---

async function handleCustomerName(from, text, twiml) {
    // Logic fix: If text is empty (from Errand flow without details), we might be coming from an error state.
    // But usually, we arrive here from 'add_more_or_checkout' or 'errand_details'.
    // We must validate that text is NOT empty.
    if (!text || text.trim().length === 0) {
        return twiml.message("⚠️ Name cannot be empty. Please type your name.");
    }

    await db.ref(`users/${from}`).update({
        step: 'customer_phone',
        customer_name: text
    });
    twiml.message("📞 Please share your Phone Number (e.g. 08012345678).");
}

async function handleCustomerPhone(from, text, twiml) {
    const cleanPhone = text.replace(/\D/g,'');
    if (cleanPhone.length < 10) return twiml.message("⚠️ Invalid phone number. Please enter a valid number.");

    await db.ref(`users/${from}`).update({
        step: 'pickup_location',
        customer_phone: cleanPhone
    });

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();

    if (user.order_type === 'food') {
        twiml.message(`📍 *Where is the Pickup Location?*\n\n1. ${VENDOR_NAME} (Default)\n2. Type a different address\n\nReply 1 or 2.`);
    } else {
        twiml.message("📍 Where is the Pickup Location? (Market, Pharmacy, Person's House, etc)");
    }
}

async function handlePickupLocation(from, text, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    let location = text;

    if (user.order_type === 'food' && text.trim() === '1') {
        location = VENDOR_ADDRESS;
    } else if (user.order_type === 'food' && text.trim() === '2') {
        await db.ref(`users/${from}/step`).set('pickup_location_manual');
        return twiml.message("📍 Please type the specific pickup address:");
    }

    await db.ref(`users/${from}`).update({
        step: 'delivery_location',
        pickup_location: location
    });
    twiml.message("📍 Where should the rider drop the items? (Your Hostel/Room/Address)");
}

async function handleDeliveryLocation(from, text, twiml) {
    await db.ref(`users/${from}`).update({
        step: 'confirm_order',
        delivery_location: text
    });
    await generateOrderSummary(from, twiml);
}

async function generateOrderSummary(from, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    let total = 0;
    let summary = `🧾 *ORDER SUMMARY*\n\n`;

    // Customer Details
    summary += `👤 Name: ${user.customer_name}\n`;
    summary += `📞 Phone: ${user.customer_phone}\n\n`;

    // Order Content
    if (user.order_type === 'food') {
        total = user.cart_subtotal || 0;
        user.cart.forEach(c => {
            summary += `${c.name} (${c.size}) x${c.qty}\n`;
        });
        summary += `\nFood Cost: ${formatCurrency(total)}`;
    } else {
        if (user.errand_items && user.errand_items.length > 0) {
            total = user.shopping_budget || 0;
            summary += `Items:\n`;
            user.errand_items.forEach(i => summary += `- ${i.name}\n`);
            summary += `\nItems Cost: ${formatCurrency(total)}`;
            if (user.needs_shopping) summary += `\nShopping Fee: ${formatCurrency(SHOPPING_FEE)}`;
            total += SHOPPING_FEE;
        } else {
            summary += `Task/Details: ${user.errand_description}\n`;
            total = SHOPPING_FEE;
            summary += `\nService Fee: ${formatCurrency(SHOPPING_FEE)}`;
        }
    }

    total += DELIVERY_FEE;
    summary += `\n📍 Pickup: ${user.pickup_location}`;
    summary += `\n🏠 Delivery: ${user.delivery_location}`;
    summary += `\n🚚 Delivery Fee: ${formatCurrency(DELIVERY_FEE)}`;
    summary += `\n━━━━━━━━━━━\n💰 *TOTAL: ${formatCurrency(total)}*`;

    await db.ref(`users/${from}`).update({ final_total: total });

    summary += `\n\nReply "CONFIRM" to proceed to payment.`;
    twiml.message(summary);
}

async function handleFinalConfirm(from, msg, twiml) {
  if (msg !== 'confirm') return twiml.message("Please type CONFIRM to proceed.");

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();

  await db.ref(`users/${from}`).update({
    step: 'awaiting_payment'
  });

  twiml.message(`💳 *Payment Details*\n\nPlease pay ${formatCurrency(user.final_total)} to:\n\n🏦 *Bank:* Monie Point\n👤 *Name:* ChowZone Dev\n🔢 *Acct:* 70437763589\n\n📸 *Send a screenshot of the receipt here to complete your order.*`);
}

// --- 8. ADMIN & ORDER LOGIC ---

async function createOrderInDB(from, user, twiml, mediaUrl) {
  const orderId = generateId();
  const total = user.final_total;
  
  let orderDetails = [];
  if (user.order_type === 'food') {
      orderDetails = user.cart;
  } else if (user.errand_items) {
      orderDetails = user.errand_items;
  } else {
      orderDetails = [{ name: user.errand_description || "Errand Task", price: 0 }];
  }

  const orderData = {
    id: orderId,
    customer: from,
    customer_name: user.customer_name,
    customer_phone: user.customer_phone,
    type: user.order_type,
    status: 'pending_payment',
    total: total,
    delivery_loc: user.delivery_location,
    pickup_loc: user.pickup_location,
    details: orderDetails,
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  await db.ref(`orders/${orderId}`).set(orderData);
  
  // Store Order ID in user session for rating later
  await db.ref(`users/${from}`).update({ 
      step: 'new',
      last_order_id: orderId 
  });

  twiml.message(`✅ *Order Received!*\n\nYour Order #${orderId} is worth ${formatCurrency(total)}.\n\nWe are verifying your payment now. You will be notified shortly.`);

  try {
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    let adminPhone = ADMIN_PHONE;
    if (!adminPhone.startsWith('whatsapp:')) {
      adminPhone = `whatsapp:${adminPhone}`;
    }

    let itemsList = "";
    if (user.order_type === 'food') {
      user.cart.forEach(c => itemsList += `- ${c.name} (${c.size}) x${c.qty}\n`);
    } else {
      if (user.errand_items) {
          user.errand_items.forEach(i => itemsList += `- ${i.name}\n`);
      } else {
          itemsList += `- ${user.errand_description}\n`;
      }
    }

    const adminMsg = `💳 *NEW PAYMENT ALERT*\n\n` +
                    `Order ID: #${orderId}\n` +
                    `Type: ${user.order_type.toUpperCase()}\n` +
                    `Customer: ${user.customer_name}\n` +
                    `Phone: ${user.customer_phone}\n` +
                    `Pickup: ${user.pickup_location}\n` +
                    `Delivery: ${user.delivery_location}\n` +
                    `Total: ${formatCurrency(total)}\n\n` +
                    `Items:\n${itemsList}`;

    // FIX: Send Image if it exists
    const messageOptions = {
      from: process.env.TWILIO_PHONE_NUMBER,
      to: adminPhone,
      body: adminMsg
    };

    if (mediaUrl) {
      messageOptions.mediaUrl = [mediaUrl];
    }

    await client.messages.create(messageOptions);
  } catch (err) {
    console.error("Failed to send Admin notification:", err);
  }
}

async function approveOrder(orderId) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return;

  await db.ref(`orders/${orderId}/status`).set('seeking_rider');
  
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: order.customer,
    body: `✅ *Payment Verified*\n\nYour Order #${orderId} has been placed! We are assigning a rider now.`
  });

  broadcastToRiders(orderId, order);
}

async function rejectOrder(orderId) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return;

  await db.ref(`orders/${orderId}/status`).set('rejected');

  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: order.customer,
    body: `❌ *Payment Not Found*\n\nWe could not verify your payment for Order #${orderId}. Please contact Admin or try again.`
  });
}

async function acceptOrder(riderPhone, orderId, twiml) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  
  if (order.status !== 'seeking_rider') return twiml.message("Job already taken or closed.");

  const riderSnap = await db.ref(`riders/${riderPhone}`).once('value');
  const rider = riderSnap.val();

  await db.ref(`orders/${orderId}`).update({
    status: 'rider_accepted',
    rider_phone: riderPhone,
    rider_name: rider.name
  });

  twiml.message(`✅ You have accepted Order #${orderId}. Wait for Admin to contact you regarding payment details.`);

  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const adminMsg = `🛵 *RIDER ACCEPTED JOB*\n\n` +
                  `Order #${orderId}\n` +
                  `Rider Name: ${rider.name}\n` +
                  `Rider Phone: ${riderPhone}\n\n` +
                  `Please contact rider to arrange details and send the order payment to his account manually.`;

  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: ADMIN_PHONE,
    body: adminMsg
  });

  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: order.customer,
    body: `🛵 *Rider Assigned*\n\nOrder #${orderId}\nRider Name: ${rider.name}\nRider Phone: ${riderPhone}\n\nExpect delivery shortly.`
  });
}

async function updateOrderStatus(orderId, status, twiml, from) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (order.rider_phone !== from) return twiml.message("Not your order.");

  await db.ref(`orders/${orderId}/status`).set(status);
  
  if (status === 'delivered') {
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Trigger Rating Flow for Customer
    await db.ref(`users/${order.customer}`).update({ step: 'rate_rider' });
    
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: order.customer,
      body: `✅ *Order Delivered!*\n\nOrder #${orderId} is complete.\n\nPlease rate your Rider (1-5 stars):`
    });
    
    twiml.message(`✅ Order #${orderId} marked as Delivered. Good job!`);
  }
}

// --- RATING HANDLERS ---
async function handleRateRider(from, msg, twiml) {
    const rating = parseInt(msg);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return twiml.message("Please enter a number between 1 and 5.");
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const orderId = user.last_order_id;

    // Save rating to DB
    await db.ref(`orders/${orderId}/rating/rider`).set(rating);

    await db.ref(`users/${from}`).update({ step: 'rate_service' });
    twiml.message(`Thanks! How would you rate ChowZone service? (1-5 stars)`);
}

async function handleRateService(from, msg, twiml) {
    const rating = parseInt(msg);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return twiml.message("Please enter a number between 1 and 5.");
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const orderId = user.last_order_id;

    // Save rating to DB
    await db.ref(`orders/${orderId}/rating/service`).set(rating);

    await db.ref(`users/${from}`).update({ step: 'new' });
    twiml.message(`Thank you for your feedback! We hope to see you again soon. 🍽️`);
}


async function broadcastToRiders(orderId, order) {
  const ridersSnap = await db.ref('riders').orderByChild('status').equalTo('on_duty').once('value');
  const riders = ridersSnap.val();
  
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  let itemsSummary = "";
  if (order.type === 'food') {
      order.details.forEach(d => itemsSummary += `${d.name} x${d.qty}, `);
      itemsSummary = itemsSummary.slice(0, -2);
  } else {
      itemsSummary = order.details[0].name;
  }

  let msg = `🛵 NEW JOB #${orderId}\n`;
  msg += `Customer: ${order.customer_name}\n`;
  msg += `Phone: ${order.customer_phone}\n`;
  msg += `Pickup: ${order.pickup_loc}\n`;
  msg += `Dropoff: ${order.delivery_loc}\n`;
  msg += `Items: ${itemsSummary}\n`;
  msg += `Total Value: ${formatCurrency(order.total)}\n`;
  msg += `Delivery Fee: ${formatCurrency(DELIVERY_FEE)}\n`;
  msg += `\nReply: ACCEPT ${orderId}`;

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

// --- 9. LISTEN ---
app.get('/', (req, res) => res.send('ChowZone Bot is Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
