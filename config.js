(function () {
  const config = {
    brandName: 'Hidden Gems',
    brandShort: 'HG',
    siteUrl: 'https://hiddengems.space',
    supportEmail: 'HGemsLLC@proton.me',
    // Stripe is the active payment provider for this build.
    stripeLinks: {
      defaultVideo: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f',
      vipSubscription: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f'
    },
    payment: {
      provider: 'stripe-link',
      // Default shared video checkout link. Used for any video without a matching price tier below.
      stripeVideoLink: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f',
      // Shared Stripe checkout links by customer-facing video price in cents.
      stripeVideoLinksByPrice: {
        50: 'https://buy.stripe.com/3cIbJ101zcDsaiq1Ifbo408',
        300: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f',
        600: 'https://buy.stripe.com/cNi00j8y55b04Y6ev1bo406',
        900: 'https://buy.stripe.com/bJeeVdcOl9rg0HQaeLbo407',
        1200: 'https://buy.stripe.com/eVq7sL6pXavkduCbiPbo405',
        1500: 'https://buy.stripe.com/eVqdR94hP46W76efz5bo40b',
        3000: 'https://buy.stripe.com/dRmfZh01z32S1LUfz5bo403',
        3900: 'https://buy.stripe.com/dRm3cv9C946WgGOev1bo40c',
        6000: 'https://buy.stripe.com/8x2aEXaGd1YOfCKcmTbo402',
        9000: 'https://buy.stripe.com/bJeaEX6pX46W0HQ72zbo40e',
        12000: 'https://buy.stripe.com/4gM00jbKh46W4Y60Ebbo40d'
      },
      namedPaymentLinks: [
        { name: '$0.50 Video Link', amountCents: 50, kind: 'video', url: 'https://buy.stripe.com/3cIbJ101zcDsaiq1Ifbo408' },
        { name: '$3 Video Link', amountCents: 300, kind: 'video', url: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f' },
        { name: '$6 Video Link', amountCents: 600, kind: 'video', url: 'https://buy.stripe.com/cNi00j8y55b04Y6ev1bo406' },
        { name: '$9 Video Link', amountCents: 900, kind: 'video', url: 'https://buy.stripe.com/bJeeVdcOl9rg0HQaeLbo407' },
        { name: '$12 Video Link', amountCents: 1200, kind: 'video', url: 'https://buy.stripe.com/eVq7sL6pXavkduCbiPbo405' },
        { name: '$15 Video Link', amountCents: 1500, kind: 'video', url: 'https://buy.stripe.com/eVqdR94hP46W76efz5bo40b' },
        { name: '$30 Video Link', amountCents: 3000, kind: 'video', url: 'https://buy.stripe.com/dRmfZh01z32S1LUfz5bo403' },
        { name: '$39 Video Link', amountCents: 3900, kind: 'video', url: 'https://buy.stripe.com/dRm3cv9C946WgGOev1bo40c' },
        { name: '$60 Video Link', amountCents: 6000, kind: 'video', url: 'https://buy.stripe.com/8x2aEXaGd1YOfCKcmTbo402' },
        { name: '$90 Video Link', amountCents: 9000, kind: 'video', url: 'https://buy.stripe.com/bJeaEX6pX46W0HQ72zbo40e' },
        { name: '$120 Video Link', amountCents: 12000, kind: 'video', url: 'https://buy.stripe.com/4gM00jbKh46W4Y60Ebbo40d' },
        { name: 'VIP Subscription Link', amountCents: 0, kind: 'vip', url: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f' }
      ],
      stripeVipSubscriptionLink: 'https://buy.stripe.com/bJefZhaGd9rgduCfz5bo40f',
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
