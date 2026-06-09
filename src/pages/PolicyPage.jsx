import { Link } from 'react-router-dom'

const SITE_NAME = 'Hidden Gems'
const SUPPORT_EMAIL = 'support@hiddengems.space'
const SITE_URL = 'https://hiddengems.space'

// IMPORTANT:
// If Hidden Gems is the legal producer/primary content owner for sexually explicit visual content,
// replace these custodian values with the real legal custodian information before public launch.
// 18 U.S.C. 2257 may require the name/title and business address of the records custodian.
const RECORDS_CUSTODIAN = {
  name: 'Hidden Gems Records Custodian',
  title: 'Custodian of Records',
  businessAddress: 'Available to authorized legal authorities upon proper request through the official support contact.',
  contact: SUPPORT_EMAIL
}

const content = {
  contact: {
    eyebrow: 'Support',
    title: 'Contact Hidden Gems',
    intro:
      'Use the official support contact below for account help, point-pack questions, VIP subscription support, access-link issues, policy questions, or compliance notices.',
    sections: [
      {
        heading: 'Support contact',
        paragraphs: [
          `Email: ${SUPPORT_EMAIL}`,
          'When contacting support, include the email connected to your Hidden Gems account, the affected video title or subscription tier, and a clear description of the issue.'
        ]
      },
      {
        heading: 'Access issues',
        paragraphs: [
          'If a purchased point pack, VIP subscription, or unlocked video does not appear correctly, contact support with your account email and checkout details so the issue can be reviewed.',
          'Do not share account passwords, full card numbers, private IDs, or unnecessary sensitive information in support messages.'
        ]
      },
      {
        heading: 'Legal and policy notices',
        paragraphs: [
          'For copyright, safety, consent, compliance, or content-removal concerns, contact support with the specific URL or title involved and a detailed explanation of the request.'
        ]
      }
    ]
  },

  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    intro:
      'This Privacy Policy explains how Hidden Gems handles account, access, and transaction-related information used to operate the platform.',
    sections: [
      {
        heading: 'Information we use',
        paragraphs: [
          'Hidden Gems may use account information such as email address, login status, role, VIP tier, point balance, unlock history, library access, comments, reactions, and support requests.',
          'Payment processing is handled by the payment processor. Hidden Gems does not store full card numbers or full payment credentials on the site.'
        ]
      },
      {
        heading: 'How information is used',
        paragraphs: [
          'Information is used to provide account access, protect locked content, verify point purchases and subscriptions, process unlocks, prevent abuse, support customer service, and maintain site security.',
          'Activity such as comments, likes, dislikes, and view counts may be used to improve video listings, community features, and admin moderation.'
        ]
      },
      {
        heading: 'Third-party services',
        paragraphs: [
          'Hidden Gems may use third-party services for authentication, database hosting, payment processing, storage, analytics, external file access, and site hosting.',
          'External access links may lead to partner or file-hosting services. Users should review the policies of those third-party services before using them.'
        ]
      },
      {
        heading: 'Data requests',
        paragraphs: [
          `For privacy questions or account-related requests, contact ${SUPPORT_EMAIL}. Hidden Gems may need to verify account ownership before making account changes.`
        ]
      }
    ]
  },

  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    intro:
      'By using Hidden Gems, you agree to use the platform lawfully, follow access rules, and respect content restrictions.',
    sections: [
      {
        heading: 'Age requirement',
        paragraphs: [
          'Hidden Gems is intended only for adults who are at least 18 years old and legally permitted to access the content offered in their location.',
          'By creating an account or entering the site, you confirm that you are 18 or older and that your access is lawful where you are located.'
        ]
      },
      {
        heading: 'Account rules',
        paragraphs: [
          'Users must access content only through their own account and may not attempt to bypass login, VIP restrictions, point locks, protected external links, or technical safeguards.',
          'Sharing, reselling, scraping, redistributing, recording, leaking, or publicly reposting locked content or protected access links is prohibited.'
        ]
      },
      {
        heading: 'Digital access',
        paragraphs: [
          'Points are used for digital access inside Hidden Gems. Unlocked access is tied to the signed-in account that completed the unlock.',
          'VIP, Super VIP, and Ultra VIP access applies only while the matching subscription is active and only to content included in that tier.'
        ]
      },
      {
        heading: 'Content standards',
        paragraphs: [
          'All content offered through Hidden Gems must involve adults 18+ and consenting adults only. Content that is illegal, non-consensual, exploitative, underage, coercive, or otherwise prohibited is not allowed.',
          'Hidden Gems may remove content, restrict accounts, or deny access when necessary for safety, compliance, payment-processing, or legal reasons.'
        ]
      }
    ]
  },

  refunds: {
    eyebrow: 'Refunds',
    title: 'Refund Policy',
    intro:
      'This Refund Policy explains how Hidden Gems handles point packs, digital unlocks, and subscription access.',
    sections: [
      {
        heading: 'Digital content access',
        paragraphs: [
          'Because Hidden Gems provides digital access and protected external links after verification, refunds may be limited once points are delivered, points are spent, or content is unlocked.',
          'If an unlocked link is broken or access fails due to a technical issue, contact support so the issue can be reviewed and corrected when appropriate.'
        ]
      },
      {
        heading: 'Point packs',
        paragraphs: [
          'Unused point-pack purchases may be reviewed on a case-by-case basis. Used points, unlocked videos, and delivered digital access may be non-refundable except where required by law or platform policy.'
        ]
      },
      {
        heading: 'VIP subscriptions',
        paragraphs: [
          'VIP subscriptions provide access while active. Users are responsible for cancelling future renewals before the next billing date if they no longer want subscription access.',
          'Past subscription periods that were already active may be non-refundable except where required by law or payment-processor policy.'
        ]
      },
      {
        heading: 'How to request help',
        paragraphs: [
          `For refund or access-support requests, contact ${SUPPORT_EMAIL} with the account email, checkout date, product or tier purchased, and a description of the issue.`
        ]
      }
    ]
  },

  compliance: {
    eyebrow: 'Compliance',
    title: '18 U.S.C. 2257 Compliance Statement',
    intro:
      'Hidden Gems is intended for adults only. All models and performers displayed or referenced by the platform must be 18 years of age or older at the time of production and must have participated voluntarily.',
    sections: [
      {
        heading: 'Recordkeeping statement',
        paragraphs: [
          'For any content subject to 18 U.S.C. § 2257 or 18 U.S.C. § 2257A recordkeeping requirements, required age, identity, and performer records are maintained by the responsible producer or designated custodian of records.',
          `${SITE_NAME} requires content owners, uploaders, providers, and operators to maintain accurate records for all applicable content and to provide proof of age, identity, consent, and publication authority when requested.`
        ]
      },
      {
        heading: 'Custodian of records',
        paragraphs: [
          `Records Custodian: ${RECORDS_CUSTODIAN.name}`,
          `Title: ${RECORDS_CUSTODIAN.title}`,
          `Business Address / Records Location: ${RECORDS_CUSTODIAN.businessAddress}`,
          `Compliance Contact: ${RECORDS_CUSTODIAN.contact}`
        ]
      },
      {
        heading: 'Consent and prohibited content',
        paragraphs: [
          'Hidden Gems does not knowingly permit content involving minors, non-consensual activity, coercion, trafficking, exploitation, stolen material, or content that violates applicable law.',
          'Any user who believes content violates age, consent, copyright, or safety requirements should contact support immediately with the specific URL, title, and concern.'
        ]
      },
      {
        heading: 'Site information',
        paragraphs: [
          `Website: ${SITE_URL}`,
          `Support and compliance contact: ${SUPPORT_EMAIL}`
        ]
      }
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
        <p>{page.intro}</p>
      </section>

      <section className="section policy-stack">
        {page.sections.map((section) => (
          <article className="card policy-card" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
        ))}
      </section>

      <section className="section actions centered-text">
        <Link className="button" to="/access-info">Access Info</Link>
        <Link className="ghost-button" to="/about">About Hidden Gems</Link>
      </section>
    </div>
  )
}
