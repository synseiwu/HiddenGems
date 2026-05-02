(function () {
  const config = {
    brandName: 'Hidden Gems',
    brandShort: 'HG',
    siteUrl: 'https://hiddengems.space',
    supportEmail: 'HGemsLLC@proton.me',
    // Stripe is the active payment provider for this build.
    stripeLinks: {
      defaultVideo: 'https://buy.stripe.com/test_14A8wP3d24yj0Xa0143Ru00',
      vipSubscription: 'https://buy.stripe.com/test_6oUcN57ti0i35dqcNQ3Ru01'
    },
    payment: {
      provider: 'stripe-link',
      // Default shared video checkout link. Used for any price tier that does not have its own link below.
      stripeVideoLink: 'https://buy.stripe.com/test_14A8wP3d24yj0Xa0143Ru00',
      // Optional: paste separate shared Stripe links here as you create $3 / $5 / $7 payment links.
      // Keys are video prices in cents.
      stripeVideoLinksByPrice: {
        300: '',
        500: '',
        700: ''
      },
      stripeVipSubscriptionLink: 'https://buy.stripe.com/test_6oUcN57ti0i35dqcNQ3Ru01',
      edgeFunctionUrl: ''
    },
    adminEmails: ['hayzrxsloth@gmail.com', 'patrickkinshin223@gmail.com'],
    adminUserIds: ['c5d8de69-a371-408f-a595-9aa026a6de45', '3ce8409c-f2d4-4372-8b2b-bb4e6f4a8b91'],
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
