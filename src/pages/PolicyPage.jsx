import { Link } from 'react-router-dom'

const content = {
  contact: {
    eyebrow: 'Contact',
    title: 'Contact Hidden Gems',
    paragraphs: [
      'For account access, point-pack questions, VIP subscription support, or unlocked-link issues, contact Hidden Gems support through the official support channel you provide for customers.',
      'When contacting support, include the email connected to your Hidden Gems account, the video title, and a short explanation of the issue so it can be reviewed faster.'
    ]
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    paragraphs: [
      'Hidden Gems uses account information to provide login access, point balances, unlock history, VIP status, and library access. Payment processing is handled through Stripe.',
      'The site stores only the information needed to operate the marketplace, protect access, and verify purchases or subscriptions. Full payment details are handled by Stripe, not stored directly by Hidden Gems.'
    ]
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    paragraphs: [
      'By using Hidden Gems, users agree to access content only through their own account and not attempt to bypass locked links, VIP restrictions, or point-based unlock requirements.',
      'Points are used for digital access inside Hidden Gems. Unlocked video access is tied to the signed-in account that completed the unlock.'
    ]
  },
  refunds: {
    eyebrow: 'Refunds',
    title: 'Refund Policy',
    paragraphs: [
      'Because Hidden Gems provides digital access and external file links after verification, refund eligibility may be limited once points are used or content is unlocked.',
      'If there is a technical issue with access, users should contact support with their account email and the affected video title so the issue can be reviewed.'
    ]
  },
  compliance: {
    eyebrow: 'Compliance',
    title: '18 USC 2257 Compliance',
    paragraphs: [
      'Hidden Gems is intended to operate as a premium digital access platform with supporting policy and safety pages. Any required age, identity, or recordkeeping compliance information should be maintained by the responsible content owner/operator.',
      'This page is a placeholder for the site owner to publish the exact official 18 USC 2257 compliance statement, custodian details, and any legally required notices before public launch.'
    ]
  }
}

export default function PolicyPage({ type }) {
  const page = content[type] || content.contact

  return (
    <div className="page info-page narrow">
      <section className="card info-hero-card">
        <span className="eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <section className="section actions centered-text">
        <Link className="button" to="/access-info">Access Info</Link>
        <Link className="ghost-button" to="/about">About Hidden Gems</Link>
      </section>
    </div>
  )
}
