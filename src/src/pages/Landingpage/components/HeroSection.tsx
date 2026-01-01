import { useState } from "react";
import { FiArrowRight } from "react-icons/fi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

interface HeroSectionProps {
  onDemoAction?: () => void;
}

const HeroSection = ({ onDemoAction }: HeroSectionProps) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (status === "loading") return;
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Please enter your email.");
      return;
    }

    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/leads/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing-hero" }),
      });
      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 422) {
          throw new Error("Please enter a valid email address.");
        }
        throw new Error(detail || "Unable to submit your email.");
      }
      setStatus("success");
      setMessage("Thanks! We'll reach out to schedule your demo.");
      setEmail("");
      onDemoAction?.();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to submit your email."
      );
    }
  };
  return (
    <section className="landing-hero landing-section">
      <div className="landing-hero__bg" />
      <div className="landing-hero__orb landing-hero__orb--one" />
      <div className="landing-hero__orb landing-hero__orb--two" />
      <div className="landing-hero__grid" />

      <div className="landing-container">
        <div className="landing-hero__layout">
          <div className="landing-hero__copy">
            {/* Headline */}
            <h1 className="landing-title landing-title--hero">
              One <span className="landing-gradient-text">Analytics-First</span>{" "}
              Platform For Modern HR
            </h1>

            {/* Subheadline */}
            <p className="landing-subtitle landing-subtitle--hero animate-fade-up">
              Power HR decisions with real-time analytics that track the full employee journey, from hiring to retirement.
            </p>

            {/* Email capture */}
            <div className="landing-hero__form animate-fade-up">
              <input
                type="email"
                className="landing-hero__input"
                placeholder="Enter your email"
                aria-label="Enter your email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status !== "idle") {
                    setStatus("idle");
                    setMessage(null);
                  }
                }}
              />
              <button
                type="button"
                className="landing-button landing-button--primary landing-button--lg landing-button--pill"
                onClick={handleSubmit}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Submitting..." : "Get a Demo"}
                <FiArrowRight />
              </button>
            </div>
            {message && (
              <p
                className={`landing-hero__form-note ${
                  status === "error" ? "landing-hero__form-note--error" : ""
                }`}
                role={status === "error" ? "alert" : "status"}
              >
                {message}
              </p>
            )}
          </div>

          <div className="landing-hero__visuals">
            <div className="landing-hero__visuals-frame animate-fade-up">
              <div className="landing-laptop">
                <div className="landing-laptop__screen">
                  <div className="landing-laptop__camera" />
                  <img
                    src="/Screenshot%202025-12-28%20at%2020.47.25.png"
                    alt="HR dashboard preview"
                    className="landing-laptop__image"
                  />
                </div>
                <svg
                  className="landing-laptop__backdrop"
                  viewBox="0 0 100 50"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    className="landing-laptop__arc landing-laptop__arc--outer"
                    d="M 0 50 A 50 50 0 0 1 100 50"
                  />
                  <path
                    className="landing-laptop__arc landing-laptop__arc--inner"
                    d="M 10 50 A 40 40 0 0 1 90 50"
                  />
                </svg>
                <div className="landing-laptop__base">
                  <span className="landing-laptop__badge">POWERED BY ZAROHR</span>
                </div>
                <div className="landing-laptop__shadow" />
              </div>
              <div className="landing-hero__mini-card landing-hero__mini-card--right-top">
                <div className="landing-hero__mini-title">Total Employee</div>
                <div className="landing-hero__mini-value">2680</div>
                <div className="landing-hero__mini-meta">
                  Update: 22 Sep 2024 <span>+12%</span>
                </div>
              </div>
              <div className="landing-hero__mini-card landing-hero__mini-card--right-bottom">
                <div className="landing-hero__mini-title">Attrition</div>
                <svg
                  className="landing-hero__mini-line"
                  viewBox="0 0 140 50"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M 6 36 Q 36 28 62 26 T 108 16 T 134 24" />
                  <g className="landing-hero__mini-points">
                    <circle cx="6" cy="38" r="4" />
                    <circle cx="52" cy="30" r="4" />
                    <circle cx="96" cy="18" r="4" />
                    <circle cx="134" cy="26" r="4" />
                  </g>
                  <g className="landing-hero__mini-labels">
                    <text x="6" y="20">15</text>
                    <text x="52" y="16">37</text>
                    <text x="96" y="12">67</text>
                    <text x="134" y="12">41</text>
                  </g>
                </svg>
              </div>
              <div className="landing-hero__mini-card landing-hero__mini-card--left-top">
                <div className="landing-hero__mini-chart">
                  {["M", "T", "W", "T", "F"].map((label, index) => (
                    <div className="landing-hero__mini-bar" key={`${label}-${index}`}>
                      <span />
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="landing-hero__mini-card landing-hero__mini-card--left-bottom">
                <div className="landing-hero__mini-title">Total Hires</div>
                <div className="landing-hero__mini-value">86</div>
                <div className="landing-hero__mini-meta">
                  Update: 22 Sep 2024 <span>+08%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Fade */}
      <div className="landing-hero__fade" />
    </section>
  );
};

export default HeroSection;
