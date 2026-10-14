/** Original late-90s console football logo: ball with a fire trail, chrome
 *  name and a gold edition number. Shared by the intro and the title screen. */
export function RetroBall({ className = "" }: { className?: string }) {
  return (
    <svg className={`retro-ball ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="retro-ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.65" stopColor="#d9dde6" />
          <stop offset="1" stopColor="#6b7284" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#retro-ball-shade)" stroke="#111" strokeWidth="3" />
      <polygon points="50,30 69,44 62,66 38,66 31,44" fill="#16181f" />
      <path
        d="M50 30V6M69 44l22-8M62 66l14 20M38 66L24 86M31 44L9 36"
        stroke="#16181f"
        strokeWidth="4"
      />
    </svg>
  );
}

export function RetroLogo({ name }: { name: string }) {
  const title = (name || "SEBASTIAN").toUpperCase();
  return (
    <div className="retro-logo" role="img" aria-label={`Mundial ${title} Soccer 26`}>
      <span className="retro-logo-fire" />
      <RetroBall className="retro-logo-ball" />
      <span className="retro-logo-mundial">MUNDIAL</span>
      <span
        className="retro-logo-name"
        style={{ fontSize: `clamp(30px, ${Math.min(9, 72 / title.length)}vw, 112px)` }}
      >
        {title}
      </span>
      <span className="retro-logo-soccer">SOCCER</span>
      <span className="retro-logo-number">26</span>
    </div>
  );
}
