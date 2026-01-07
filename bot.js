require('dotenv').config();
const twilio = require('twilio');
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: false }));

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const PORT = process.env.PORT || 3000;

app.post('/whatsapp', async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const body = req.body.Body || '';
  const from = req.body.From;

  if (body.toLowerCase() === 'hi') {
    // WE ARE ONLY TESTING BUTTONS HERE
    const msg = new twilio.twiml.MessagingResponse();
    const list = msg.message("Choose an option:");
    
    list.addContent(twilio.twiml.ContentOption.create({ 
      body: "Hello World!", 
      contentType: "text/plain" 
    }));
    
    list.addContent(twilio.twiml.ContentOption.create({ 
      body: "Option 2", 
      contentType: "text/plain" 
    }));

    res.type('text/xml').send(msg.toString());
  } else {
    twiml.message("I didn't understand.");
    res.type('text/xml').send(twiml.toString());
  }
});

app.listen(PORT, () => console.log(`Test server running on ${PORT}`));
