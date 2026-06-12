import { useEffect, useMemo, useState } from 'react'
import { getPublicSiteSettings } from '../lib/api'

const defaultSiteModeSettings = {
  hide_all_videos: false,
  disable_age_gate: false,
  safe_mode_enabled: false,
  site_mode: 'hidden_gems',
  ai_studio_public_mode: false,
  hide_hidden_gems_branding: true,
  hide_video_marketplace_in_ai_mode: true,
  show_admin_mode_switch: true,
  show_public_mode_switch: false
}

export function isAIStudioMode(settings = {}) {
  return settings.site_mode === 'ai_studio' || Boolean(settings.ai_studio_public_mode)
}

export function shouldHideMarketplace(settings = {}) {
  return Boolean(
    settings.hide_all_videos ||
    settings.safe_mode_enabled ||
    (isAIStudioMode(settings) && settings.hide_video_marketplace_in_ai_mode !== false)
  )
}

export default function useSiteMode() {
  const [settings, setSettings] = useState(defaultSiteModeSettings)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const next = await getPublicSiteSettings().catch(() => defaultSiteModeSettings)
    setSettings({ ...defaultSiteModeSettings, ...next })
    setLoading(false)
  }

  useEffect(() => {
    refresh()

    function handleRefresh() {
      refresh()
    }

    window.addEventListener('hidden-gems:site-mode-refresh', handleRefresh)
    window.addEventListener('focus', handleRefresh)

    return () => {
      window.removeEventListener('hidden-gems:site-mode-refresh', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
    }
  }, [])

  return useMemo(() => ({
    settings,
    loading,
    isAiMode: isAIStudioMode(settings),
    hideMarketplace: shouldHideMarketplace(settings),
    refresh
  }), [settings, loading])
}
