import { Link } from 'react-router-dom'
import { Bot, ShieldCheck } from 'lucide-react'
import '../styles/mode-pages.css'

export default function ModeUnavailable({
  title = 'This section is unavailable in AI Studio Mode',
  text = 'The public site is currently focused on AI Studio. Hidden Gems marketplace sections are hidden until the site is switched back.',
  adminText = '',
  showAiButton = true
}) {
  return (
    <div className="page narrow">
      <section className="card mode-unavailable-card">
        <Bot size={46} />
        <span className="eyebrow">AI Studio Mode</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {adminText && <p>{adminText}</p>}
        <div className="actions centered-text">
          {showAiButton && <Link className="button" to="/ai-studio">Open AI Studio</Link>}
          <Link className="ghost-button" to="/points">Buy Points</Link>
          <Link className="ghost-button" to="/account"><ShieldCheck size={16} /> Account</Link>
        </div>
      </section>
    </div>
  )
}
