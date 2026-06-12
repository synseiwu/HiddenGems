import { Link } from 'react-router-dom'
import useSiteContent from '../hooks/useSiteContent'
import useSiteMode from '../hooks/useSiteMode'
import { getDefaultPageSections } from '../lib/defaultPageContent'
import '../styles/policy-pages.css'
import '../styles/mode-pages.css'

const typeToPageKey = {
  contact: 'contact',
  privacy: 'privacy',
  terms: 'terms',
  refunds: 'refunds',
  compliance: 'compliance'
}

const aiPolicyContent = {
  contact: {
    intro: {
      eyebrow: 'Support',
      title: 'Contact AI Studio',
      subtitle: 'Use the official support contact for account help, point-pack questions, AI Studio access, billing, or technical support.'
    },
    sections: [
      {
        title: 'Account and AI support',
        body: 'For AI Studio support, include the email connected to your account, what you were trying to do, and any error message you saw. Do not send passwords, full card numbers, or unnecessary sensitive information.'
      },
      {
        title: 'Billing and points',
        body: 'For point-pack or billing questions, include your account email and checkout details so the purchase can be reviewed.'
      }
    ]
  },
  privacy: {
    intro: {
      eyebrow: 'Privacy',
      title: 'AI Studio Privacy Policy',
      subtitle: 'This Privacy Policy explains how AI Studio handles account, wallet, and AI workspace information.'
    },
    sections: [
      {
        title: 'Information used',
        body: 'AI Studio may use account information such as email address, login status, role, point balance, AI conversations, AI messages, usage logs, and support requests.\n\nPayment processing is handled by the payment processor. AI Studio does not store full card numbers or full payment credentials on the site.'
      },
      {
        title: 'AI conversations',
        body: 'AI conversations and messages may be saved to the user account so users can continue their workspace later. Users should avoid submitting sensitive personal information into prompts.'
      },
      {
        title: 'How information is used',
        body: 'Information is used to provide account access, process point usage, operate AI tools, prevent abuse, support customers, and maintain platform security.'
      }
    ]
  },
  terms: {
    intro: {
      eyebrow: 'Terms',
      title: 'AI Studio Terms of Use',
      subtitle: 'By using AI Studio, users agree to use the platform lawfully and follow account, wallet, and AI usage rules.'
    },
    sections: [
      {
        title: 'Account rules',
        body: 'Users must use their own account and may not attempt to bypass login, points, admin controls, or technical safeguards.'
      },
      {
        title: 'AI usage',
        body: 'Users are responsible for the prompts they submit and how they use AI-generated output. AI responses may be inaccurate, incomplete, or unsuitable for some uses, so users should review outputs before relying on them.'
      },
      {
        title: 'Platform access',
        body: 'AI Studio may limit, disable, or adjust features when needed for safety, compliance, cost control, abuse prevention, or technical maintenance.'
      }
    ]
  },
  refunds: {
    intro: {
      eyebrow: 'Refunds',
      title: 'AI Studio Refund Policy',
      subtitle: 'This Refund Policy explains how point packs and digital AI access are handled.'
    },
    sections: [
      {
        title: 'Digital point access',
        body: 'Point packs are digital goods delivered to the account wallet after payment verification. Refunds may be limited once points are delivered or used for AI messages or enabled tools.'
      },
      {
        title: 'Technical issues',
        body: 'If points are charged but an AI request fails due to a platform issue, contact support with your account email and the approximate time of the issue so it can be reviewed.'
      }
    ]
  },
  compliance: {
    intro: {
      eyebrow: 'Compliance',
      title: 'Mode-Specific Compliance Notice',
      subtitle: '18 U.S.C. 2257 compliance information applies to Hidden Gems Mode and video-related content, not the AI Studio public mode.'
    },
    sections: [
      {
        title: 'AI Studio Mode',
        body: 'AI Studio Mode is focused on point-based AI access, saved conversations, and account-based digital tools. Video marketplace compliance pages are hidden from the footer while AI Studio Mode is active.'
      },
      {
        title: 'Hidden Gems Mode',
        body: 'When Hidden Gems Mode is active, video-related policy and compliance pages apply according to the published Hidden Gems terms and compliance notices.'
      }
    ]
  }
}

function paragraphsFromBody(body) {
  return String(body || '').split('\n\n').map((item) => item.trim()).filter(Boolean)
}

export default function PolicyPage({ type }) {
  const pageKey = typeToPageKey[type] || 'contact'
  const { isAiMode } = useSiteMode()
  const defaultSections = getDefaultPageSections(pageKey)
  const { sections } = useSiteContent(pageKey)

  if (isAiMode) {
    const content = aiPolicyContent[pageKey] || aiPolicyContent.contact
    return (
      <div className="page info-page narrow policy-page-shell mode-aware-page">
        <section className="card info-hero-card">
          <div className="policy-card-inner info-hero-inner">
            <span className="eyebrow">{content.intro.eyebrow}</span>
            <h1>{content.intro.title}</h1>
            <p>{content.intro.subtitle}</p>
          </div>
        </section>

        <section className="section policy-stack">
          {content.sections.map((section) => (
            <article className="card policy-card" key={section.title}>
              <div className="policy-card-inner">
                <h2>{section.title}</h2>
                {paragraphsFromBody(section.body).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
          ))}
        </section>

        <section className="section actions centered-text policy-actions">
          <Link className="button" to="/ai-studio">Open AI Studio</Link>
          <Link className="ghost-button" to="/access-info">Access Info</Link>
          <Link className="ghost-button" to="/points">Buy Points</Link>
        </section>
      </div>
    )
  }

  const introKey = sections.intro ? 'intro' : Object.keys(defaultSections)[0]
  const intro = sections[introKey] || defaultSections[introKey] || {}
  const sectionEntries = Object.entries(sections).filter(([key]) => key !== introKey)

  return (
    <div className="page info-page narrow policy-page-shell mode-aware-page">
      <section className="card info-hero-card">
        <div className="policy-card-inner info-hero-inner">
          <span className="eyebrow">{intro.eyebrow || defaultSections[introKey]?.eyebrow}</span>
          <h1>{intro.title || defaultSections[introKey]?.title}</h1>
          <p>{intro.subtitle || defaultSections[introKey]?.subtitle || intro.body}</p>
        </div>
      </section>

      <section className="section policy-stack">
        {sectionEntries.map(([sectionKey, section]) => (
          <article className="card policy-card" key={sectionKey}>
            <div className="policy-card-inner">
              <h2>{section.title || sectionKey.replaceAll('_', ' ')}</h2>
              {section.subtitle && <p>{section.subtitle}</p>}
              {paragraphsFromBody(section.body).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </article>
        ))}
      </section>

      <section className="section actions centered-text policy-actions">
        <Link className="button" to="/access-info">Access Info</Link>
        <Link className="ghost-button" to="/about">About Hidden Gems</Link>
      </section>
    </div>
  )
}
