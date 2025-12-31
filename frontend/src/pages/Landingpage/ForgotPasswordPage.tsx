import { useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface ForgotPasswordPageProps {
  onBack?: () => void;
}

function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to send reset email.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="landing-page landing-auth">
      <div className="landing-container">
        <div className="landing-auth__grid">
          <section className="landing-auth__panel landing-auth__panel--compact">
            <div className="landing-pill landing-pill--accent">
              Password recovery
            </div>
            <h1 className="landing-auth__title">Reset your password</h1>
            <p className="landing-auth__subtitle">
              Enter your work email and we will send a reset link.
            </p>

            <form className="landing-auth__form" onSubmit={handleSubmit}>
              <label className="landing-auth__field">
                Work email
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="landing-auth__input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              {submitted ? (
                <div className="landing-auth__success">
                  Reset link sent. Check your inbox.
                </div>
              ) : null}
              {error ? <p className="landing-auth__error">{error}</p> : null}

              <button
                type="submit"
                className="landing-button landing-button--primary landing-button--lg landing-auth__action"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <div className="landing-auth__footer">
              <button
                type="button"
                className="landing-link"
                onClick={onBack}
              >
                Back to sign in
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
