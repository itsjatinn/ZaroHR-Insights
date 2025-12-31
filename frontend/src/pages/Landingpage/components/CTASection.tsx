import { FiArrowRight } from "react-icons/fi";

interface CTASectionProps {
  onPrimaryAction?: () => void;
}

const CTASection = ({ onPrimaryAction }: CTASectionProps) => {
  return (
    <section id="contact" className="landing-section  landing-cta">
      <div className="landing-container">
        <div className="landing-cta__inner">
          <div className="landing-card landing-cta__card landing-cta__card--outline">
            <h2 className="landing-title landing-cta__title">
              Ready to Transform Your{" "}
              <span className="landing-gradient-text">HR Analytics?</span>
            </h2>
            <p className="landing-subtitle landing-cta__subtitle">
              Join 500+ organizations that have revolutionized their workforce management
              with data-driven insights. Partner with us to elevate your HR strategy.
            </p>

            {/* CTA Buttons */}
            <div className="landing-cta__actions">
              <button
                type="button"
                className="landing-button landing-button--primary landing-button--xl"
                onClick={onPrimaryAction}
              >
                Join Us
                <FiArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
