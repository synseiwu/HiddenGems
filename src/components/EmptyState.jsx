export default function EmptyState({ title, text, action }) {
  return (
    <section className="empty-state card">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  )
}
