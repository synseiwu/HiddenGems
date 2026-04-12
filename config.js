window.GEMS_HIDDEN_CONFIG = {
  brandName: 'Hidden Gems',
  brandShort: 'HG',
  siteUrl: 'https://hiddengems.space',
  supportEmail: 'hayzerxsloth@gmail.com',
  paypalLinks: {
    default: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N',
    vip: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N',
    points: 'https://www.paypal.com/ncp/payment/TH74PFXUPCR2N',
    pointsPackages: {
      starter: 'https://www.paypal.com/ncp/payment/REPLACE_STARTER_LINK',
      silver: 'https://www.paypal.com/ncp/payment/REPLACE_SILVER_LINK',
      gold: 'https://www.paypal.com/ncp/payment/REPLACE_GOLD_LINK',
      vault: 'https://www.paypal.com/ncp/payment/REPLACE_VAULT_LINK'
    }
  },
  pointsPackages: [
    { id: 'starter', points: 500, price: '$5', amount: '5.00', label: 'Starter Pack', copy: 'A quick top-up for smaller unlocks' },
    { id: 'silver', points: 1200, price: '$10', amount: '10.00', label: 'Silver Pack', copy: 'A balanced option for regular purchases' },
    { id: 'gold', points: 2500, price: '$20', amount: '20.00', label: 'Gold Pack', copy: 'Better value for building your library' },
    { id: 'vault', points: 6000, price: '$40', amount: '40.00', label: 'Vault Pack', copy: 'Best value for heavy unlocks' }
  ],
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
