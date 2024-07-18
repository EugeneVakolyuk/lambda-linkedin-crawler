const Mixpanel = require('mixpanel');

const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN, {
    secret: process.env.MIXPANEL_SECRET,
});

module.exports = mixpanel;
