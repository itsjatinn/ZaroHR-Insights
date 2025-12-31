import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 2, suffix: "M+", label: "Employees Analyzed", description: "Data-driven decisions" },
  { value: 98, suffix: "%", label: "Client Satisfaction", description: "Industry-leading support" },
  { value: 15, suffix: "+", label: "Years Experience", description: "HR analytics expertise" },
];

const CountUp = ({ end, suffix, duration = 2000 }: { end: number; suffix: string; duration?: number }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return (
    <div ref={ref} className="landing-stat__value landing-gradient-text">
      {count}{suffix}
    </div>
  );
};

const StatsSection = () => {
  return (
    <section id="about" className="landing-section">
      <div className="landing-container">
        <div className="landing-section__header">
          <span className="landing-pill landing-pill--accent">
            Our Impact
          </span>
          <h2 className="landing-title">
            Driving Results That{" "}
            <span className="landing-gradient-text">Matter</span>
          </h2>
          <p className="landing-subtitle">
            We've helped hundreds of organizations transform their HR operations 
            with actionable insights and measurable outcomes.
          </p>
        </div>

        <div className="landing-stats__grid">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="landing-card landing-card--hover landing-stat-card"
            >
              <CountUp end={stat.value} suffix={stat.suffix} />
              <h3 className="landing-title" style={{ fontSize: "1.1rem", margin: "1rem 0 0.4rem" }}>
                {stat.label}
              </h3>
              <p className="landing-subtitle" style={{ fontSize: "0.9rem" }}>
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
