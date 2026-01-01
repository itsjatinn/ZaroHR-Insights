import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

interface ResetPasswordPageProps {
  token?: string | null;
  onBack?: () => void;
}

function ResetPasswordPage({ token, onBack }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tokenValue = useMemo(() => token?.trim() || "", [token]);

  useEffect(() => {
    if (!tokenValue) {
      setError("Reset link is invalid or missing.");
    }
  }, [tokenValue]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!tokenValue) {
      setError("Reset link is invalid or missing.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenValue, password }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to reset password.");
      }
      setSuccess(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="landing-page landing-auth">
      <div className="landing-container">
        <div className="landing-auth__grid">
          <section className="landing-auth__panel landing-auth__panel--compact">
            <div className="landing-pill">Secure reset</div>
            <h1 className="landing-auth__title">Set a new password</h1>
            <p className="landing-auth__subtitle">
              Choose a strong password you will use to sign in next time.
            </p>

            <form className="landing-auth__form" onSubmit={handleSubmit}>
              <label className="landing-auth__field">
                New password
                <div className="landing-auth__input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
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
              <label className="landing-auth__field">
                Confirm password
                <div className="landing-auth__input-wrap">
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat password"
                    className="landing-auth__input"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="landing-auth__toggle"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </label>

              {success ? (
                <div className="landing-auth__success">
                  Password updated. You can sign in now.
                </div>
              ) : null}
              {error ? <p className="landing-auth__error">{error}</p> : null}

              <button
                type="submit"
                className="landing-button landing-button--primary landing-button--lg landing-auth__action"
                disabled={submitting || success}
              >
                {submitting ? "Updating..." : "Update password"}
              </button>
            </form>

            <div className="landing-auth__footer">
              <button type="button" className="landing-link" onClick={onBack}>
                Back to sign in
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default ResetPasswordPage;
