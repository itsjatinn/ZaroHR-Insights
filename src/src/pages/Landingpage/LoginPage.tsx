import { useState } from "react";
import "./App.css";
import { FiEye, FiEyeOff } from "react-icons/fi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

interface LoginResult {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string | null;
}

interface LoginPageProps {
  onLogin?: (result: LoginResult) => void;
  onForgotPassword?: () => void;
}

function LoginPage({ onLogin, onForgotPassword }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Login failed.");
      }
      const payload = (await response.json()) as LoginResult;
      onLogin?.(payload);
      localStorage.setItem("hrdash:user", JSON.stringify(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="landing-page landing-auth">
      <div className="landing-container">
        <div className="landing-auth__grid">
          <section className="landing-auth__panel">
            <div className="landing-pill">Secure workspace</div>
            <h1 className="landing-auth__title">Welcome back</h1>
            <p className="landing-auth__subtitle">
              Sign in to manage dashboards, uploads, and analytics for your
              organization.
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
              <label className="landing-auth__field">
                Password
                <div className="landing-auth__input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="landing-auth__input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="landing-auth__toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </label>

              <div className="landing-auth__meta">
                <button
                  type="button"
                  className="landing-link"
                  onClick={onForgotPassword}
                >
                  Forgot password
                </button>
              </div>

              {error ? <p className="landing-auth__error">{error}</p> : null}

              <button
                type="submit"
                className="landing-button landing-button--primary landing-button--lg landing-auth__action"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

          </section>

        </div>
      </div>
    </main>
  );
}

export default LoginPage;
