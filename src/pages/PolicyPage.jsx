import { Link } from 'react-router-dom'
import useSiteContent from '../hooks/useSiteContent'
import { getDefaultPageSections } from '../lib/defaultPageContent'
import '../styles/policy-pages.css'

const typeToPageKey = {
  contact: 'contact',
  privacy: 'privacy',
  terms: 'terms',
  refunds: 'refunds',
  compliance: 'compliance'
}

function paragraphsFromBody(body) {
  return String(body || '').split('\n\n').map((item) => item.trim()).filter(Boolean)
}

export default function PolicyPage({ type }) {
  const pageKey = typeToPageKey[type] || 'contact'
  const defaultSections = getDefaultPageSections(pageKey)
  const { sections } = useSiteContent(pageKey)

  const introKey = sections.intro ? 'intro' : Object.keys(defaultSections)[0]
  const intro = sections[introKey] || defaultSections[introKey] || {}
  const sectionEntries = Object.entries(sections).filter(([key]) => key !== introKey)

  return (
    <div className="page info-page narrow policy-page-shell">
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
