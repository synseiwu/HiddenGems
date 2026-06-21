import { useEffect, useMemo, useState } from 'react'
import {
  adminCancelScheduledPointAward,
  adminCreateScheduledPointAward,
  adminGetRewardsDashboard,
  adminGrantRewardPoints,
  adminListRecentPointTransactions,
  adminListScheduledPointAwards,
  adminProcessDueScheduledPointAwards,
  adminResetAllUserRewards,
  adminResetRewardForAll,
  adminResetUserReward,
  adminSaveRewardsSettings,
  adminSearchRewardUsers
} from '../lib/api'
import Loader from './Loader'
import '../styles/admin-rewards.css'

const defaultSettings = {
  rewards_enabled: true,
  starter_bonus_enabled: true,
  starter_bonus_points: 300,
  daily_reward_enabled: true,
  daily_guest_points: 10,
  daily_user_points: 10,
  daily_vip_points: 50,
  daily_super_vip_points: 100,
  daily_supervip_points: 100,
  daily_ultra_vip_points: 150,
  daily_ultravip_points: 150,
  admin_daily_rewards_enabled: false,
  admin_daily_points: 0,
  username_bonus_enabled: true,
  username_bonus_points: 100,
  hidden_gems_access_bonus_enabled: true,
  hidden_gems_access_bonus_points: 100,
  comment_reward_enabled: true,
  comment_rewards_enabled: true,
  comment_reward_points: 10,
  comment_reward_cooldown_hours: 24,
  min_comment_seconds: 20,
  reward_popups_enabled: true,
  reward_inbox_notifications_enabled: true,
  require_manual_grant_reason: true
}

const defaultSchedule = {
  title: '',
  description: '',
  points: 100,
  recipient_type: 'one_user',
  target_user_id: '',
  target_role: '',
  scheduled_for: '',
  repeat_type: 'none',
  repeat_until: '',
  active: true,
  send_inbox_notification: true,
  popup_enabled: false
}

const rewardOptions = [
  { key: 'starter_bonus', label: 'Starter/signup bonus' },
  { key: 'daily_login', label: 'Daily login reward' },
  { key: 'username_bonus', label: 'Username bonus' },
  { key: 'hidden_gems_access_bonus', label: 'Hidden Gems access bonus' },
  { key: 'comment_reward', label: 'Comment reward' }
]

export default function AdminRewardsPanel() {
  const [tab, setTab] = useState('settings')
  const [settings, setSettings] = useState(defaultSettings)
  const [scheduledAwards, setScheduledAwards] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [grant, setGrant] = useState({ amount: 100, reason: 'Admin manual point grant', sendInboxNotification: true })
  const [resetRewardKey, setResetRewardKey] = useState('username_bonus')
  const [schedule, setSchedule] = useState(defaultSchedule)

  const selectedUserLabel = useMemo(() => {
    if (!selectedUser) return ''
    return selectedUser.username ? `@${selectedUser.username}` : selectedUser.email
  }, [selectedUser])

  async function load() {
    setLoading(true)
    setNotice('')

    try {
      const dashboard = await adminGetRewardsDashboard()
      setSettings({ ...defaultSettings, ...(dashboard.settings || {}) })
      setScheduledAwards(dashboard.scheduled_awards || [])
      setTransactions(dashboard.transactions || [])
    } catch (err) {
      setNotice(err.message || 'Could not load reward settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function setSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'daily_super_vip_points') next.daily_supervip_points = value
      if (key === 'daily_supervip_points') next.daily_super_vip_points = value
      if (key === 'daily_ultra_vip_points') next.daily_ultravip_points = value
      if (key === 'daily_ultravip_points') next.daily_ultra_vip_points = value
      if (key === 'comment_reward_enabled') next.comment_rewards_enabled = value
      if (key === 'comment_rewards_enabled') next.comment_reward_enabled = value

      return next
    })
  }

  async function saveSettings() {
    setBusy(true)
    setNotice('')

    try {
      const saved = await adminSaveRewardsSettings(settings)
      setSettings({ ...defaultSettings, ...(saved || settings) })
      setNotice('Reward settings saved.')
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function searchUsers(query) {
    setUserQuery(query)
    if (query.trim().length < 2) {
      setUserResults([])
      return
    }

    const users = await adminSearchRewardUsers(query).catch((err) => {
      setNotice(err.message || 'Could not search users.')
      return []
    })

    setUserResults(users)
  }

  async function manualGrant() {
    if (!selectedUser) {
      setNotice('Choose a user first.')
      return
    }

    if (settings.require_manual_grant_reason !== false && !grant.reason.trim()) {
      setNotice('A reason is required for manual point grants.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      const result = await adminGrantRewardPoints({
        userId: selectedUser.id,
        amount: grant.amount,
        reason: grant.reason,
        sendInboxNotification: grant.sendInboxNotification
      })

      setNotice(`Granted ${result?.amount || grant.amount} points to ${selectedUserLabel}.`)
      setGrant({ amount: 100, reason: 'Admin manual point grant', sendInboxNotification: true })
      await refreshTransactions()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetSelectedReward() {
    if (!selectedUser) {
      setNotice('Choose a user first.')
      return
    }

    if (!confirm(`Reset ${resetRewardKey} for ${selectedUserLabel}? This may allow them to claim it again.`)) return

    setBusy(true)
    setNotice('')

    try {
      await adminResetUserReward({ userId: selectedUser.id, rewardKey: resetRewardKey })
      setNotice(`Reset ${resetRewardKey} for ${selectedUserLabel}.`)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetAllRewardsForSelectedUser() {
    if (!selectedUser) {
      setNotice('Choose a user first.')
      return
    }

    if (!confirm(`Reset all reward flags for ${selectedUserLabel}? This may allow multiple rewards to be claimed again.`)) return

    setBusy(true)
    setNotice('')

    try {
      await adminResetAllUserRewards(selectedUser.id)
      setNotice(`Reset all reward flags for ${selectedUserLabel}.`)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetRewardGlobally() {
    if (!confirm(`Reset ${resetRewardKey} for ALL users? This is a large action and may allow many people to claim again.`)) return

    setBusy(true)
    setNotice('')

    try {
      const result = await adminResetRewardForAll(resetRewardKey)
      setNotice(`Reset ${resetRewardKey} globally. Rows affected: ${result || 0}.`)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function createScheduledAward(e) {
    e.preventDefault()
    setBusy(true)
    setNotice('')

    try {
      const payload = {
        ...schedule,
        points: Number(schedule.points || 0),
        target_user_id: schedule.recipient_type === 'one_user' ? selectedUser?.id || schedule.target_user_id : null,
        target_role: ['vip', 'supervip', 'ultravip', 'admins'].includes(schedule.recipient_type) ? schedule.recipient_type : null
      }

      if (payload.recipient_type === 'one_user' && !payload.target_user_id) {
        throw new Error('Choose a target user for this scheduled award.')
      }

      await adminCreateScheduledPointAward(payload)
      setSchedule(defaultSchedule)
      setNotice('Scheduled award created.')
      await refreshScheduled()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function refreshScheduled() {
    const awards = await adminListScheduledPointAwards().catch(() => [])
    setScheduledAwards(awards)
  }

  async function refreshTransactions() {
    const data = await adminListRecentPointTransactions().catch(() => [])
    setTransactions(data)
  }

  async function processDueAwards() {
    setBusy(true)
    setNotice('')

    try {
      const result = await adminProcessDueScheduledPointAwards()
      const processed = Array.isArray(result)
        ? result.reduce((sum, row) => sum + Number(row.processed_count || 0), 0)
        : 0
      setNotice(`Processed due awards. Recipients awarded: ${processed}.`)
      await refreshScheduled()
      await refreshTransactions()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelAward(id) {
    if (!confirm('Cancel this scheduled award?')) return
    setBusy(true)

    try {
      await adminCancelScheduledPointAward(id)
      setNotice('Scheduled award canceled.')
      await refreshScheduled()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-rewards-panel">
      <div className="admin-rewards-header card">
        <div>
          <span className="eyebrow">Rewards & Points</span>
          <h2>Rewards Admin Center</h2>
          <p>Customize point rewards, manually grant points, reset reward claims, and schedule future awards.</p>
        </div>
        <button className="button" type="button" onClick={processDueAwards} disabled={busy}>
          {busy ? 'Working...' : 'Process Due Awards'}
        </button>
      </div>

      {notice && <p className="notice-text admin-reward-notice">{notice}</p>}

      <div className="message-tabs admin-reward-tabs">
        <button className={tab === 'settings' ? 'active' : ''} type="button" onClick={() => setTab('settings')}>Settings</button>
        <button className={tab === 'manual' ? 'active' : ''} type="button" onClick={() => setTab('manual')}>Manual Grants & Resets</button>
        <button className={tab === 'scheduled' ? 'active' : ''} type="button" onClick={() => setTab('scheduled')}>Scheduled Awards</button>
        <button className={tab === 'transactions' ? 'active' : ''} type="button" onClick={() => setTab('transactions')}>Transactions</button>
      </div>

      {tab === 'settings' && (
        <section className="admin-reward-grid">
          <article className="card reward-settings-card">
            <span className="eyebrow">Global</span>
            <h3>Reward Controls</h3>
            <div className="reward-toggle-grid">
              <label className="check"><input type="checkbox" checked={settings.rewards_enabled !== false} onChange={(e) => setSetting('rewards_enabled', e.target.checked)} /> Rewards enabled</label>
              <label className="check"><input type="checkbox" checked={settings.reward_popups_enabled !== false} onChange={(e) => setSetting('reward_popups_enabled', e.target.checked)} /> Reward popups</label>
              <label className="check"><input type="checkbox" checked={settings.reward_inbox_notifications_enabled !== false} onChange={(e) => setSetting('reward_inbox_notifications_enabled', e.target.checked)} /> Inbox notifications</label>
              <label className="check"><input type="checkbox" checked={settings.require_manual_grant_reason !== false} onChange={(e) => setSetting('require_manual_grant_reason', e.target.checked)} /> Require manual grant reason</label>
            </div>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Signup</span>
            <h3>Starter Bonus</h3>
            <label className="check"><input type="checkbox" checked={settings.starter_bonus_enabled !== false} onChange={(e) => setSetting('starter_bonus_enabled', e.target.checked)} /> Enabled</label>
            <label>Points<input type="number" value={settings.starter_bonus_points || 0} onChange={(e) => setSetting('starter_bonus_points', Number(e.target.value))} /></label>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Daily</span>
            <h3>Daily Login Rewards</h3>
            <label className="check"><input type="checkbox" checked={settings.daily_reward_enabled !== false} onChange={(e) => setSetting('daily_reward_enabled', e.target.checked)} /> Enabled</label>
            <div className="reward-input-grid">
              <label>User/Guest<input type="number" value={settings.daily_user_points || settings.daily_guest_points || 0} onChange={(e) => { setSetting('daily_user_points', Number(e.target.value)); setSetting('daily_guest_points', Number(e.target.value)) }} /></label>
              <label>VIP<input type="number" value={settings.daily_vip_points || 0} onChange={(e) => setSetting('daily_vip_points', Number(e.target.value))} /></label>
              <label>Super VIP<input type="number" value={settings.daily_super_vip_points || settings.daily_supervip_points || 0} onChange={(e) => setSetting('daily_super_vip_points', Number(e.target.value))} /></label>
              <label>Ultra VIP<input type="number" value={settings.daily_ultra_vip_points || settings.daily_ultravip_points || 0} onChange={(e) => setSetting('daily_ultra_vip_points', Number(e.target.value))} /></label>
            </div>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Profile</span>
            <h3>Username Bonus</h3>
            <label className="check"><input type="checkbox" checked={settings.username_bonus_enabled !== false} onChange={(e) => setSetting('username_bonus_enabled', e.target.checked)} /> Enabled</label>
            <label>Points<input type="number" value={settings.username_bonus_points || 0} onChange={(e) => setSetting('username_bonus_points', Number(e.target.value))} /></label>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Access Info</span>
            <h3>Hidden Gems Access Bonus</h3>
            <label className="check"><input type="checkbox" checked={settings.hidden_gems_access_bonus_enabled !== false} onChange={(e) => setSetting('hidden_gems_access_bonus_enabled', e.target.checked)} /> Enabled</label>
            <label>Points<input type="number" value={settings.hidden_gems_access_bonus_points || 0} onChange={(e) => setSetting('hidden_gems_access_bonus_points', Number(e.target.value))} /></label>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Comments</span>
            <h3>Comment Reward</h3>
            <label className="check"><input type="checkbox" checked={settings.comment_reward_enabled !== false && settings.comment_rewards_enabled !== false} onChange={(e) => setSetting('comment_reward_enabled', e.target.checked)} /> Enabled</label>
            <div className="reward-input-grid">
              <label>Points<input type="number" value={settings.comment_reward_points || 0} onChange={(e) => setSetting('comment_reward_points', Number(e.target.value))} /></label>
              <label>Cooldown hours<input type="number" value={settings.comment_reward_cooldown_hours || 24} onChange={(e) => setSetting('comment_reward_cooldown_hours', Number(e.target.value))} /></label>
            </div>
          </article>

          <div className="actions reward-save-actions">
            <button className="button" type="button" onClick={saveSettings} disabled={busy}>{busy ? 'Saving...' : 'Save Reward Settings'}</button>
          </div>
        </section>
      )}

      {tab === 'manual' && (
        <section className="admin-manual-grid">
          <article className="card reward-user-search-card">
            <span className="eyebrow">User Search</span>
            <h3>Select User</h3>
            <label>Username or email<input value={userQuery} onChange={(e) => searchUsers(e.target.value)} placeholder="Search username or email..." /></label>
            <div className="reward-user-results">
              {userResults.map((user) => (
                <button key={user.id} type="button" className={selectedUser?.id === user.id ? 'selected' : ''} onClick={() => setSelectedUser(user)}>
                  <strong>{user.username ? `@${user.username}` : user.email}</strong>
                  <small>{user.role || 'user'} · rank {user.vip_rank || 0}</small>
                </button>
              ))}
            </div>
            {selectedUser && <p className="notice-text">Selected: {selectedUserLabel}</p>}
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Manual Grant</span>
            <h3>Grant Points</h3>
            <label>Amount<input type="number" value={grant.amount} onChange={(e) => setGrant((prev) => ({ ...prev, amount: Number(e.target.value) }))} /></label>
            <label>Reason<textarea value={grant.reason} onChange={(e) => setGrant((prev) => ({ ...prev, reason: e.target.value }))} rows="4" /></label>
            <label className="check"><input type="checkbox" checked={grant.sendInboxNotification} onChange={(e) => setGrant((prev) => ({ ...prev, sendInboxNotification: e.target.checked }))} /> Send inbox notification</label>
            <button className="button" type="button" onClick={manualGrant} disabled={busy}>Grant Points</button>
          </article>

          <article className="card reward-settings-card">
            <span className="eyebrow">Reset Tools</span>
            <h3>Reset Rewards</h3>
            <label>Reward type<select value={resetRewardKey} onChange={(e) => setResetRewardKey(e.target.value)}>
              {rewardOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select></label>
            <button className="ghost-button" type="button" onClick={resetSelectedReward} disabled={busy}>Reset Selected Reward for User</button>
            <button className="ghost-button" type="button" onClick={resetAllRewardsForSelectedUser} disabled={busy}>Reset All Rewards for User</button>
            <button className="danger-button" type="button" onClick={resetRewardGlobally} disabled={busy}>Reset Selected Reward for All Users</button>
          </article>
        </section>
      )}

      {tab === 'scheduled' && (
        <section className="scheduled-awards-grid">
          <form className="card scheduled-award-form" onSubmit={createScheduledAward}>
            <span className="eyebrow">Schedule</span>
            <h3>Create Scheduled Award</h3>

            <label>Title<input value={schedule.title} onChange={(e) => setSchedule((prev) => ({ ...prev, title: e.target.value }))} required /></label>
            <label>Description<textarea value={schedule.description} onChange={(e) => setSchedule((prev) => ({ ...prev, description: e.target.value }))} rows="3" /></label>

            <div className="reward-input-grid">
              <label>Points<input type="number" value={schedule.points} onChange={(e) => setSchedule((prev) => ({ ...prev, points: Number(e.target.value) }))} required /></label>
              <label>Recipient<select value={schedule.recipient_type} onChange={(e) => setSchedule((prev) => ({ ...prev, recipient_type: e.target.value }))}>
                <option value="one_user">One selected user</option>
                <option value="all">All users</option>
                <option value="vip">VIP users</option>
                <option value="supervip">Super VIP users</option>
                <option value="ultravip">Ultra VIP users</option>
                <option value="admins">Admins</option>
              </select></label>
            </div>

            {schedule.recipient_type === 'one_user' && (
              <p className="muted">Target user: {selectedUserLabel || 'Select a user from the Manual Grants & Resets user search first.'}</p>
            )}

            <div className="reward-input-grid">
              <label>Scheduled for<input type="datetime-local" value={schedule.scheduled_for} onChange={(e) => setSchedule((prev) => ({ ...prev, scheduled_for: e.target.value }))} required /></label>
              <label>Repeat<select value={schedule.repeat_type} onChange={(e) => setSchedule((prev) => ({ ...prev, repeat_type: e.target.value }))}>
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select></label>
            </div>

            {schedule.repeat_type !== 'none' && (
              <label>Repeat until optional<input type="datetime-local" value={schedule.repeat_until} onChange={(e) => setSchedule((prev) => ({ ...prev, repeat_until: e.target.value }))} /></label>
            )}

            <div className="reward-toggle-grid">
              <label className="check"><input type="checkbox" checked={schedule.active} onChange={(e) => setSchedule((prev) => ({ ...prev, active: e.target.checked }))} /> Active</label>
              <label className="check"><input type="checkbox" checked={schedule.send_inbox_notification} onChange={(e) => setSchedule((prev) => ({ ...prev, send_inbox_notification: e.target.checked }))} /> Inbox notification</label>
              <label className="check"><input type="checkbox" checked={schedule.popup_enabled} onChange={(e) => setSchedule((prev) => ({ ...prev, popup_enabled: e.target.checked }))} /> Popup if supported</label>
            </div>

            <button className="button" disabled={busy}>{busy ? 'Saving...' : 'Create Scheduled Award'}</button>
          </form>

          <div className="card scheduled-awards-list">
            <div className="split-line">
              <div>
                <span className="eyebrow">Upcoming & Recent</span>
                <h3>Scheduled Awards</h3>
              </div>
              <button className="ghost-button" type="button" onClick={processDueAwards} disabled={busy}>Process Due</button>
            </div>

            <div className="scheduled-award-items">
              {scheduledAwards.length ? scheduledAwards.map((award) => (
                <article className="scheduled-award-item" key={award.id}>
                  <div>
                    <span className={`reward-status ${award.status}`}>{award.status}</span>
                    <span className="reward-status">{award.recipient_type}</span>
                    {award.repeat_type !== 'none' && <span className="reward-status">{award.repeat_type}</span>}
                  </div>
                  <h4>{award.title}</h4>
                  <p>{award.description || 'No description.'}</p>
                  <small>{award.points} points · next run {award.next_run_at ? new Date(award.next_run_at).toLocaleString() : 'not set'}</small>
                  <div className="actions">
                    {award.active && award.status !== 'canceled' && <button className="danger-button" type="button" onClick={() => cancelAward(award.id)}>Cancel</button>}
                  </div>
                </article>
              )) : <p className="muted">No scheduled awards yet.</p>}
            </div>
          </div>
        </section>
      )}

      {tab === 'transactions' && (
        <section className="card reward-transactions-card">
          <div className="split-line">
            <div>
              <span className="eyebrow">Ledger</span>
              <h3>Recent Point Transactions</h3>
            </div>
            <button className="ghost-button" type="button" onClick={refreshTransactions}>Refresh</button>
          </div>

          <div className="reward-transaction-list">
            {transactions.length ? transactions.map((tx) => (
              <article className="reward-transaction-item" key={tx.id || `${tx.user_id}-${tx.created_at}-${tx.amount}`}>
                <strong>{tx.username ? `@${tx.username}` : tx.email || tx.user_id}</strong>
                <span>{tx.amount > 0 ? '+' : ''}{tx.amount} points</span>
                <small>{tx.transaction_type} · {tx.description || 'No description'} · {new Date(tx.created_at).toLocaleString()}</small>
              </article>
            )) : <p className="muted">No transactions found.</p>}
          </div>
        </section>
      )}
    </section>
  )
}
