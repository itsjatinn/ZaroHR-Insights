import { useEffect } from "react";
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
  onContactAction?: () => void;
  onDemoAction?: () => void;
}

const Index = ({
  onPrimaryAction,
  onContactAction,
  onDemoAction,
}: LandingPageProps) => {
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
      />
      <Footer />
    </main>
  );
};

export default Index;
