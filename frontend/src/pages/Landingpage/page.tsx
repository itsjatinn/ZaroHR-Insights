import { useEffect, useState } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import ServicesSection from "./components/ServicesSection";
import StatsSection from "./components/StatsSection";
import TestimonialsSection from "./components/TestimonialsSection";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";

interface LandingPageProps {
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onContactAction?: () => void;
  onDemoAction?: () => void;
}

const Index = ({
  onPrimaryAction,
  onContactAction,
  onDemoAction,
}: LandingPageProps) => {
  const [demoOpen, setDemoOpen] = useState(false);

  const openDemo = () => setDemoOpen(true);
  const closeDemo = () => setDemoOpen(false);

  useEffect(() => {
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflowY;

    const updateScrollLock = () => {
      if (demoOpen) {
        body.style.overflowY = "hidden";
        return;
      }
      const pageHeight = Math.max(body.scrollHeight, documentElement.scrollHeight);
      const viewportHeight = window.innerHeight;
      body.style.overflowY = pageHeight > viewportHeight ? "auto" : "hidden";
    };

    updateScrollLock();
    window.addEventListener("resize", updateScrollLock);

    return () => {
      window.removeEventListener("resize", updateScrollLock);
      body.style.overflowY = prevOverflow;
    };
  }, [demoOpen]);

  useEffect(() => {
    const servicesSection = document.querySelector("#services");
    if (!servicesSection) {
      return () => undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("landing-services--reveal", entry.isIntersecting);
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(servicesSection);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const brakeZone = 420;
    const minFactor = 0.2;

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable) return;
      if (event.ctrlKey || event.metaKey) return;
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

  return (
    <main className="landing-page">
      <Navbar
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={openDemo}
        onContactAction={onContactAction}
      />
      <HeroSection
        onDemoAction={onDemoAction}
      />
      <ServicesSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection
        onPrimaryAction={onContactAction}
        onSecondaryAction={openDemo}
      />
      <Footer />
      {demoOpen && (
        <div className="landing-demo" role="dialog" aria-modal="true">
          <div className="landing-demo__backdrop" onClick={closeDemo} />
          <div className="landing-demo__panel" role="document">
            <button
              type="button"
              className="landing-demo__close"
              onClick={closeDemo}
              aria-label="Close demo preview"
            >
              Close
            </button>
            <div className="landing-demo__preview">
              <div className="landing-demo__header">
                <div className="landing-demo__title">HR Analytics Preview</div>
                <div className="landing-demo__meta">
                  Sample dashboard snapshot
                </div>
              </div>
              <div className="landing-demo__stats">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="landing-demo__stat" key={index}>
                    <div className="landing-demo__stat-label" />
                    <div className="landing-demo__stat-value" />
                  </div>
                ))}
              </div>
              <div className="landing-demo__grid">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="landing-demo__chart" key={index}>
                    <div className="landing-demo__chart-title" />
                    <div className="landing-demo__chart-body" />
                  </div>
                ))}
              </div>
              <div className="landing-demo__mask">
                <div className="landing-demo__mask-content">
                  <h3>Demo Preview</h3>
                  <p>Full analytics are available after sign in.</p>
                  <button
                    type="button"
                    className="landing-button landing-button--primary landing-button--lg"
                    onClick={onPrimaryAction}
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Index;
