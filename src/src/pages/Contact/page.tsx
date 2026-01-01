import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import "./contact.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

const ContactPage = () => {
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  useEffect(() => {
    const brakeZone = 420;
    const minFactor = 0.2;

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable) return;
      if (!event.deltaY) return;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;

      const scrollTop = window.scrollY;
      const distanceToTop = scrollTop;
      const distanceToBottom = maxScroll - scrollTop;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);

      if (delta > 0 && distanceToBottom < brakeZone) {
        const t = Math.max(distanceToBottom, 0) / brakeZone;
        const factor = minFactor + (1 - minFactor) * t;
        event.preventDefault();
        window.scrollBy(0, delta * factor);
      }

      if (delta < 0 && distanceToTop < brakeZone) {
        const t = Math.max(distanceToTop, 0) / brakeZone;
        const factor = minFactor + (1 - minFactor) * t;
        event.preventDefault();
        window.scrollBy(0, delta * factor);
      }
    };

    const options = { passive: false } as AddEventListenerOptions;
    window.addEventListener("wheel", handleWheel, options);
    return () => window.removeEventListener("wheel", handleWheel, options);
  }, []);

  const handleChange = (field: keyof typeof formState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
      if (status !== "idle") {
        setStatus("idle");
        setResponseMessage(null);
      }
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") return;

    const payload = {
      first_name: formState.firstName.trim(),
      last_name: formState.lastName.trim(),
      email: formState.email.trim(),
      company: formState.company.trim(),
      team_size: formState.teamSize,
      message: formState.message.trim(),
    };

    if (!payload.first_name || !payload.email || !payload.message) {
      setStatus("error");
      setResponseMessage("Please fill in your name, email, and message.");
      return;
    }

    setStatus("loading");
    setResponseMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to send your request.");
      }

      setStatus("success");
      setResponseMessage("Thanks! We'll get back to you soon.");
      setFormState({
        firstName: "",
        lastName: "",
        email: "",
        company: "",
        teamSize: "",
        message: "",
      });
    } catch (error) {
      setStatus("error");
      setResponseMessage(
        error instanceof Error ? error.message : "Unable to send your request."
      );
    }
  };

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-hero__bg" />
        <div className="contact-container contact-hero__content">
          <p className="contact-pill">Contact Us</p>
          <h1 className="contact-title">
            Talk to the ZaroHR Insights team
          </h1>
          <p className="contact-subtitle">
            Get tailored guidance on workforce analytics, implementation, and
            onboarding. We usually respond within one business day.
          </p>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-container contact-grid">
          <div className="contact-card contact-card--info">
            <h2>How can we help?</h2>
            <p>
              Choose the best channel for your team. Our specialists can walk
              you through product fit, security, and rollout planning.
            </p>
            <div className="contact-info">
              <div>
                <span className="contact-label">Email</span>
                <p>insights@zarohr.com</p>
              </div>
              <div>
                <span className="contact-label">Phone</span>
                <p>+91 98335 76742</p>
              </div>
              <div>
                <span className="contact-label">Office Address</span>
                <p>ZaroHR Solutions — OneDegree Co-Working, Bhandup (W), Mumbai-400078</p>
              </div>
            </div>
            <div className="contact-hours">
              <span className="contact-label">Timings</span>
              <p>Monday to Friday, 9:00 AM to 6:00 PM</p>
            </div>
          </div>

          <div className="contact-card contact-card--form">
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form__row">
                <label>
                  <span>First name</span>
                  <input
                    type="text"
                    placeholder="Avery"
                    value={formState.firstName}
                    onChange={handleChange("firstName")}
                    required
                  />
                </label>
                <label>
                  <span>Last name</span>
                  <input
                    type="text"
                    placeholder="Jordan"
                    value={formState.lastName}
                    onChange={handleChange("lastName")}
                  />
                </label>
              </div>
              <label>
                <span>Work email</span>
                <input
                  type="email"
                  placeholder="avery@company.com"
                  value={formState.email}
                  onChange={handleChange("email")}
                  required
                />
              </label>
              <label>
                <span>Company</span>
                <input
                  type="text"
                  placeholder="Company name"
                  value={formState.company}
                  onChange={handleChange("company")}
                />
              </label>
              <label>
                <span>Team size</span>
                <select
                  value={formState.teamSize}
                  onChange={handleChange("teamSize")}
                >
                  <option value="" disabled>
                    Select team size
                  </option>
                  <option value="1-50">1-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-1000">201-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </label>
              <label>
                <span>How can we help?</span>
                <textarea
                  rows={4}
                  placeholder="Tell us about your goals."
                  value={formState.message}
                  onChange={handleChange("message")}
                  required
                />
              </label>
              <div className="contact-form__actions">
                <button type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Sending..." : "Send Request"}
                </button>
                <p>We will never share your information.</p>
              </div>
              {responseMessage && (
                <p
                  className={`contact-form__status ${
                    status === "error" ? "contact-form__status--error" : ""
                  }`}
                  role={status === "error" ? "alert" : "status"}
                >
                  {responseMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;
