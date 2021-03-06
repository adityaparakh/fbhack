/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request');

var app = express();
app.set('port', process.env.PORT || 1600);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));
var locs = ['San Francisco', 'Seattle', 'Chicago', 'Baltimore'];
var interests = ['zumba', 'fifa', 'beach cleanup', 'art gallery', 'movies', 'biking', 'mystery', 'gym', 'hacking', 'cooking', 'theatre'];

/*
 * Be sure to setup your config values before running this code. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */
const MESSSAGE_KEYS = new Set();
// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  const VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

app.get('/test', function(req, res) {
    let request = require('request');
    var fat = "";
    var response = "";
    var sender_psid = "123"
    var initializeSomeShit = getLeftOverPeople(sender_psid);
    console.log(initializeSomeShit);
    initializeSomeShit.then(function(result) {
        response = {'text':userDetails};
    }, function(err) {
        response = {'text':err};
        var psids = ["2170306669668559","1964122107006784"]

        psids.forEach(id => {
            postRequest(id, "Sup ya smelly bois")
        })
    })
    res.status(200).send(fat);
});



/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
       // Gets the body of the webhook event
      let webhook_event = pageEntry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        console.log(messagingEvent);
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL.
 *
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger'
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'image':
        sendImageMessage(senderID);
        break;

      case 'gif':
        sendGifMessage(senderID);
        break;

      case 'audio':
        sendAudioMessage(senderID);
        break;

      case 'video':
        sendVideoMessage(senderID);
        break;

      case 'file':
        sendFileMessage(senderID);
        break;

      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break;

      case 'read receipt':
        sendReadReceipt(senderID);
        break;

      case 'typing on':
        sendTypingOn(senderID);
        break;

      case 'typing off':
        sendTypingOff(senderID);
        break;

      case 'account linking':
        sendAccountLinking(senderID);
        break;

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 *
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 *
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + "/assets/allofus480.mov"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: SERVER_URL + "/assets/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPER_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What's your favorite movie genre?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Action",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type":"text",
          "title":"Comedy",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
        },
        {
          "content_type":"text",
          "title":"Drama",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons:[{
            type: "account_link",
            url: SERVER_URL + "/authorize"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

 // Handles messages events
function handleMessage(sender_psid, received_message) {
  var response;
  var messageText =received_message.text;
  // Check if the message contains text
  if (messageText) {    
    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    console.log('beg');
    var initializePromise = getInConvo(sender_psid);
    console.log(initializePromise);
    console.log('beg2');
    initializePromise.then(function(result){
      console.log('beg3');
      var userDetails = result;
      // Use user details from here
      response = {'text':userDetails};
      //callSendAPI(sender_psid,response);
      }, function(err) {
      var trueval = JSON.parse(err);
      console.log(trueval);
      console.log('856');
      console.log(trueval);
      //console.log(err);
      //parse here adi
      var nconv = 0;
      if (trueval){
        const greeting = firstEntity(received_message.nlp, 'greetings');
        const datetime = firstEntity(received_message.nlp, 'datetime');
        const thanks = firstEntity(received_message.nlp, 'thanks');
        if (greeting && greeting.confidence > 0.8) {
          console.log('852');
           var initializePromise = getUserInfo(sender_psid);
           console.log(initializePromise);
           initializePromise.then(function(result) {
            userDetails = result;
            // Use user details from here
            response = {'text':userDetails};
            //callSendAPI(sender_psid,response);
            }, function(err) {
             console.log("printing err.....");
             console.log(err);
               console.log(JSON.parse(err));
               var replyText = "Howdy, Mete!. I am Connectify. I help create group activities for you so you can do the things that matter and leave the scheduling up to me!.  Let's get started. What do you want to do and when are you available?";

               if(sender_psid == "2170306669668559"){
                   var replyText = "Hey, Muhammad!. Welcome toConnectify. Lets get your activities started, when are you available and what would you like to do?";

               }

               var response = {'text':replyText};
             callSendAPI(sender_psid,response);
          });

          } else if(datetime && datetime.confidence > 0.8) {
              //response = handleDatetime(sender_psid,datetime,messageText);
            console.log("Date time.............");
            console.log(messageText);
            var i;
            var ouri = "hacking";
            for (i=0;i<=interests.length;i++)
            {
              if (messageText.includes(interests[i])){
                 ouri = interests[i];
                break;
              }
            }

              var weekday = new Array(7);
              weekday[0] = "Sunday";
              weekday[1] = "Monday";
              weekday[2] = "Tuesday";
              weekday[3] = "Wednesday";
              weekday[4] = "Thursday";
              weekday[5] = "Friday";
              weekday[6] = "Saturday";
              weekday[7] = "sunday";
              weekday[8] = "monday";
              weekday[9] = "tuesday";
              weekday[10] = "wednesday";
              weekday[11] = "thursday";
              weekday[12] = "friday";
              weekday[13] = "saturday";



              var day;
              for (i=0;i<=weekday.length;i++){
                if (messageText.includes(weekday[i])){
                  var day = weekday[i];
                  break;
                }
              } 


              var response = {"text":"Got it. "+ouri+" on "+day+". I'll crunch some algorithms and hit you back when I find a good match!"};
              console.log(response);

              addUser(sender_psid);
              callSendAPI(sender_psid,response);

          } else if(thanks && thanks.confidence > 0.8){
            response = { "text": 'You are welcome' };
            if(sender_psid == "2170306669668559"){
               response = "No problem Muhammad!";

          }
            callSendAPI(sender_psid,response);

        }else{

          response = { "text": 'I didnt quite get that, what would you like to do today ' };
          callSendAPI(sender_psid,response);
        }
      }else{
        //userinconvo

          var initializeSomeShit = getLeftOverPeople(sender_psid);
          console.log(initializeSomeShit);
          initializeSomeShit.then(function(result) {
              response = {'text':userDetails};
          }, function(err) {
              response = {'text':err};
                  console.log(err);
                  console.log("printing some shit...");
                  console.log(err);
                  console.log(messageText);

                  var userName = "";

                  if(sender_psid == "2170306669668559"){
                    userName = "Muhammad";
                  }
                  if(sender_psid == "1964122107006784"){
                    userName = "Mete";
                  }
                  if(sender_psid == "2250191591681882"){
                    userName = "Adi";
                  }
                  var newMessage = "[" + userName + "] says: " + messageText;
                  if(!MESSSAGE_KEYS.has(messageText) && !MESSSAGE_KEYS.has(newMessage)){
                      var psids = ["2170306669668559","1964122107006784"];
                      var i = 0;
                      console.log(psids.length);
                      while(i<psids.length){
                          console.log("logging some stuff");
                          console.log(psids[i]);
                          postRequest(psids[i],newMessage);
                          i++;
                      }
                      MESSSAGE_KEYS.add(newMessage);
                      MESSSAGE_KEYS.add(messageText);
                  }
          });
      }
    })
    let nconv = 0 ;

  }else{
    //adi help to reroute
    var location = locs[0];
    response ={'text':'You are located in '+location+' Thank you for updating your location'};
  }


  //callSendAPI(sender_psid, response);
}

function handleGreeting(sender_psid,result) {
  //use the greeting you get to decide what type of greeting you will give
    return {'text':'Great to see you '+result+'. If you are ready just send me your avalability and I will see what I can get you scheduled with'};
  }

function addUser(sender_psid){
    var request = require('request');

    console.log(sender_psid)
    request.post(
        'https://fbhack-backend.herokuapp.com/addUser',
        { json: { "userId" : sender_psid } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body)
            }
        }
    );
}


  function postRequest(sender_psid,message){
      var request = require('request');

      console.log(sender_psid)
      request.post(
          'https://fbhack-backend.herokuapp.com/sendMessage',
          { json: { "userId" : sender_psid,
              "message":message } },
          function (error, response, body) {
              if (!error && response.statusCode == 200) {
                  console.log(body)
              }
          }
      );
  }

function sendMessage(sender_psid,message){
  const querystring = require('querystring');
  var postData = JSON.stringify({
    "userId" : sender_psid,
    "message":message
  })


  var fakeShit = querystring.stringify(postData);
  console.log(fakeShit.length)

  var options = {
    hostname: 'localhost',
    path: '/sendMessage',
      port: '5000',
    method: 'POST',
      rejectUnauthorized: false,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': fakeShit.length
      }
  };

  var req = https.request(options, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });

  req.write(postData);
  req.end();
}



function handleDatetime(sender_psid,datetime,messageText) {
  //use the greeting you get to decide what type of greeting you will give back
  var i;
  for (i=0;i<=interests.length;i++)
  {
    if (messageText.includes(interests[i])){
      var ouri = interests[i];
      break;
    }
  }
  console.log(datetime.values[0].value);
  var day = datetime.values[0].value;
  console.log(ouri);
  console.log(day.getDay());
  var weekday = new Array(7);
  weekday[0] = "Sunday";
  weekday[1] = "Monday";
  weekday[2] = "Tuesday";
  weekday[3] = "Wednesday";
  weekday[4] = "Thursday";
  weekday[5] = "Friday";
  weekday[6] = "Saturday";

  var n = weekday[day.getDay()];
  console.log(n);
  var response = {'text':'Great you are interested in  on  I will let you know when an event becomes available.'};
  return response;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getLeftOverPeople(sender_psid){
    let request = require('request');
    const hurl = 'https://fbhack-backend.herokuapp.com/usersLeft?userId='+sender_psid;
    var options={
        url: hurl,
    }
    return new Promise(function(resolve, reject){
        return request.get(options, function(err, resp, body) {
            if (err) {
                reject(err);
            } else {
                reject(body);
            }
        })
    })
}


function getUserInfo(sender_psid){
    let request = require('request');
    const hurl = 'https://graph.facebook.com/'+sender_psid+'?fields=first_name,last_name,profile_pic&access_token=EAAIKXN8ZAjBsBANToUfJbTPviKjhaQhvCky9jyAOKZArf0V25ensSdZCleC2sIg1Qv2MCa6x9PDRzin1YQCr3X57nWrP494Lfea71sAqTP7b4gQ7SKmJZBeIZAWZAwz6ZBeQu3PrqLZAYn3CGwcqC4TeEMI2KsTgjaRMTuApITEYCAZDZD';
    var options ={
        url: hurl,
    };
    console.log(options);
    return new Promise(function(resolve, reject){
      return request.get(options, function(err, resp, body) {
        console.log(err);
        console.log(resp);
        console.log(body);
        console.log('922')
        if (err) {
            reject(err);
        } else {
            console.log('926');
            console.log(resolve)
            reject(body);
            console.log('930');
        }
      })
    })
}


function getInConvo(sender_psid){
  let request = require('request');
  const hurl = 'https://fbhack-backend.herokuapp.com/userActive?userId='+sender_psid;
  var options={
      url: hurl,
  }
  console.log(options);
  return new Promise(function(resolve, reject){
    return request.get(options, function(err, resp, body) {
      console.log(err);
      console.log(resp);
      console.log(body);
      if (err) {
          reject(err);
      } else {
          console.log(resolve)
          reject(body);
      }
    })
  })
}



// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'weekly') {
    response = { "text": "Great I will let you know when your activiy is ready every weej" }
    //adi help create weekly
  } else if (payload === 'impromptu') {
    response = { "text": "Perfect, I will look up events you can do once and let you know soon" }
    //adihelp create impromptu
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}


function callSendAPI(messageData,response) {
  
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": messageData
    },
    "message": response
  }
  
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: request_body

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s",
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s",
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;
