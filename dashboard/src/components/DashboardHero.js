import React from 'react';

export default function DashboardHero({
  eyebrow,
  title,
  subtitle,
  badges = [],
  actions = null
}) {
  return (
    <section className="dashboard-hero">
      <div>
        {eyebrow && <div className="dashboard-hero-eyebrow">{eyebrow}</div>}
        <h1 className="dashboard-hero-title">{title}</h1>
        <p className="dashboard-hero-subtitle">{subtitle}</p>

        {badges.length > 0 && (
          <div className="dashboard-hero-badges">
            {badges.map((badge, index) => (
              <span key={`${badge}-${index}`} className="dashboard-hero-badge">
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="dashboard-hero-actions">
          {actions}
        </div>
      )}
    </section>
  );
}
