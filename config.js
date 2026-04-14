(function () {
  const config = {
    brandName: 'Hidden Gems',
    brandShort: 'HG',
    siteUrl: 'https://hiddengems.space',
    supportEmail: 'hayzergod@gmail.com',
    paypalLinks: {
      default: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N',
      vip: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N'
    },
    payment: {
      provider: 'paypal',
      edgeFunctionUrl: 'https://netolzyxnifogojwwesq.supabase.co/functions/v1/hg-paypal-checkout'
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
