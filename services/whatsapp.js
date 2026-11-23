/**
 * WhatsApp Cloud API Integration Service
 * Shri Ghanshyam Tyre House
 */

function formatIndianPhone(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // already formatted
  }
  return cleaned;
}

/**
 * Send WhatsApp text message via Meta Cloud API
 */
async function sendWhatsAppMessage(toPhone, messageBody) {
  const formattedPhone = formatIndianPhone(toPhone);
  if (!formattedPhone) {
    console.warn('[WhatsApp] Invalid recipient phone number:', toPhone);
    return { success: false, error: 'Invalid phone number' };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN || 'EAAbs0ZCj2fmgBTBQS24uDDZAgZBAYGt2eA3J07QMQM4IoaF3wTeJiWL1pB1graPvev7fo6AmnZASRF5NJyKGiAKhPDgY3MAhbvFaA9DBAhJ9Xb3QHQqut9TZAcshwQokCKCXdbJXwUzBHglQYu0KTbk2XXb6rSj9eZCLzUrtbbi3JOSgQ9J0ICzr72wU8b9iMn8VVYzPY1Q5yXv6sDDbZAVIqGlZBclPZBsaMw84YqiLBMUl72FmoULhUP2FEdbglplxu8uhhdqZCWuuaCDK1IRhhw4AZDZD';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1474663832397686';

  if (!token || !phoneId) {
    console.log(`[WhatsApp Simulated Mode] To: ${formattedPhone}`);
    console.log(`[Message]:\n${messageBody}\n`);
    return {
      success: true,
      simulated: true,
      message: 'Meta credentials not set. Simulated notification logged.'
    };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: messageBody
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[WhatsApp API Error]', data);
      return { success: false, error: data };
    }

    console.log(`[WhatsApp Sent Successfully] Message ID: ${data.messages?.[0]?.id} to ${formattedPhone}`);
    return { success: true, data };
  } catch (err) {
    console.error('[WhatsApp Network Error]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send automated order alert to both Owner and Customer
 */
async function sendOrderAlerts(order, settings = {}) {
  const ownerNumber = formatIndianPhone(settings.ownerWhatsApp || process.env.WHATSAPP_OWNER_PHONE || '919838451157');
  const customerNumber = formatIndianPhone(order.customer?.phone);

  // 1. Alert to Shop Owner
  let ownerMsg = `🚨 *NEW WEBSITE ORDER ALERT - GHANSHYAM TYRE HOUSE* 🚨\n`;
  ownerMsg += `*Order ID:* ${order.orderId}\n`;
  ownerMsg += `-----------------------------------------\n`;
  ownerMsg += `👤 *Customer Name:* ${order.customer?.name || 'Customer'}\n`;
  if (order.customer?.shopName) {
    ownerMsg += `🏪 *Shop / Business:* ${order.customer.shopName}\n`;
  }
  ownerMsg += `📞 *Customer Phone:* ${order.customer?.phone}\n`;
  ownerMsg += `📍 *Delivery Address:* ${order.customer?.address || ''}, ${order.customer?.city || ''}\n`;
  if (order.customer?.gstNumber) {
    ownerMsg += `📋 *GSTIN:* ${order.customer.gstNumber}\n`;
  }
  ownerMsg += `-----------------------------------------\n`;
  ownerMsg += `📦 *ITEMS ORDERED:*\n`;
  (order.items || []).forEach((itm, idx) => {
    ownerMsg += `${idx + 1}. ${itm.name} [Size: ${itm.size}] - Qty: ${itm.quantity} pcs @ ₹${itm.wholesalePrice} = ₹${itm.total}\n`;
  });
  ownerMsg += `-----------------------------------------\n`;
  ownerMsg += `💰 *TOTAL AMOUNT: ₹${(order.grandTotal || 0).toLocaleString('en-IN')}*\n`;
  ownerMsg += `💳 *Payment Method:* ${order.paymentMethod}\n`;
  ownerMsg += `🔴 *PAYMENT STATUS:* ${order.paymentStatus}\n`;
  if (order.transactionId) {
    ownerMsg += `🔢 *UPI / Transaction Ref:* ${order.transactionId}\n`;
  }
  if (order.notes) {
    ownerMsg += `📝 *Order Note:* ${order.notes}\n`;
  }
  ownerMsg += `-----------------------------------------\n`;
  ownerMsg += `✓ Order placed on live web store.`;

  const ownerResult = await sendWhatsAppMessage(ownerNumber, ownerMsg);

  // 2. Confirmation to Customer
  let customerResult = null;
  if (customerNumber && customerNumber !== ownerNumber) {
    let custMsg = `Namaste ${order.customer?.name || 'Valued Customer'}! 🙏\n\n`;
    custMsg += `Thank you for your order with *Shri Ghanshyam Tyre House*!\n\n`;
    custMsg += `📦 *Order ID:* ${order.orderId}\n`;
    custMsg += `💰 *Total Amount:* ₹${(order.grandTotal || 0).toLocaleString('en-IN')}\n`;
    custMsg += `💳 *Payment Method:* ${order.paymentMethod}\n`;
    custMsg += `📋 *Status:* Order Placed (Processing)\n\n`;
    custMsg += `We are preparing your tyre dispatch and will contact you shortly.\n\n`;
    custMsg += `📍 Shop No. 1, Near Tiwari Ji Ka Hata, Dharamshala Bazar Road, Gorakhpur\n`;
    custMsg += `📞 Contact/WhatsApp: +91 98384 51157`;

    customerResult = await sendWhatsAppMessage(customerNumber, custMsg);
  }

  return { ownerResult, customerResult };
}

module.exports = {
  sendWhatsAppMessage,
  sendOrderAlerts,
  formatIndianPhone
};
