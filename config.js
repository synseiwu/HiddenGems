(function () {
  const config = {
    brandName: 'Hidden Gems',
    brandShort: 'HG',
    siteUrl: 'https://hiddengems.space',
    supportEmail: 'HGemsLLC@proton.me',
    paypalLinks: {
      default: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N',
      vip: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N'
    },
    stripeLinks: {
      defaultVideo: 'https://buy.stripe.com/test_14A8wP3d24yj0Xa0143Ru00',
      vipSubscription: 'https://buy.stripe.com/test_6oUcN57ti0i35dqcNQ3Ru01'
    },
    payment: {
      provider: 'stripe-link',
      stripeVideoLink: 'https://buy.stripe.com/test_14A8wP3d24yj0Xa0143Ru00',
      stripeVipSubscriptionLink: 'https://buy.stripe.com/test_6oUcN57ti0i35dqcNQ3Ru01',
      edgeFunctionUrl: ''
    },
    adminEmails: ['hayzerxsloth@gmail.com'],
    auth: {
      provider: 'supabase',
      supabaseUrl: 'https://netolzyxnifogojwwesq.supabase.co',
      supabaseAnonKey: 'sb_publishable_UP52ijiwCiMghxs8OOEmIQ_V0GJR8Hi',
      redirectAfterLogin: 'index.html',
      redirectAfterSignup: 'login.html'
    }
  };

  // Primary config used by the site.
  window.GEMS_HIDDEN_CONFIG = config;

  // Compatibility aliases for older page scripts / prior builds.
  window.HIDDEN_GEMS_CONFIG = config;
  window.SUPABASE_URL = config.auth.supabaseUrl;
  window.SUPABASE_ANON_KEY = config.auth.supabaseAnonKey;
})();
