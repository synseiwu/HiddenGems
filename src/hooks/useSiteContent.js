import { useEffect, useMemo, useState } from 'react'
import { getSitePageContent } from '../lib/api'
import { getDefaultPageSections } from '../lib/defaultPageContent'

function mergeSections(defaults, overrides) {
  const merged = { ...defaults }
  for (const override of overrides || []) {
    if (!override?.active) continue
    const sectionKey = override.section_key
    merged[sectionKey] = {
      ...(merged[sectionKey] || {}),
      title: override.title || merged[sectionKey]?.title || '',
      subtitle: override.subtitle || merged[sectionKey]?.subtitle || '',
      eyebrow: override.eyebrow || merged[sectionKey]?.eyebrow || '',
      body: override.body || merged[sectionKey]?.body || '',
      button_text: override.button_text || merged[sectionKey]?.button_text || ''
    }
  }
  return merged
}

export default function useSiteContent(pageKey) {
  const defaults = useMemo(() => getDefaultPageSections(pageKey), [pageKey])
  const [sections, setSections] = useState(defaults)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setSections(defaults)
    setLoading(true)

    getSitePageContent(pageKey)
      .then((rows) => {
        if (active) setSections(mergeSections(defaults, rows))
      })
      .catch(() => {
        if (active) setSections(defaults)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [pageKey, defaults])

  return { sections, loading }
}
