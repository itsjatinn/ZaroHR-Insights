import {
  FiArrowRight,
  FiBarChart2,
  FiCpu,
  FiPieChart,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

const services = [
  {
    icon: FiBarChart2,
    title: "Workforce Analytics",
    description: "Gain deep visibility into your workforce metrics with real-time dashboards and customizable reports that track performance, engagement, and productivity.",
    features: ["Custom Dashboards", "Real-time Data", "Trend Analysis"]
  },
  {
    icon: FiUsers,
    title: "Employee Summary",
    description: "Search employees by name, ID, or email and pull a complete profile with personal details, role data, and tenure insights.",
    features: ["Employee Search", "Profile Snapshot", "Education & Experience"]
  },
  {
    icon: FiTrendingUp,
    title: "Dashboard Filters",
    description: "Filter dashboards by granularity, date range, and entity to drill into the exact view you need.",
    features: ["Granularity Controls", "Date Selector", "Entity-wise Charts"]
  },
  {
    icon: FiShield,
    title: "Interactive Charts",
    description: "Visualize HR metrics with dynamic charts that make trends, comparisons, and distributions easy to understand.",
    features: ["KPI Visuals", "Trend Lines", "Segment Breakdowns"]
  },
  {
    icon: FiCpu,
    title: "AI-Powered Insights",
    description: "Leverage artificial intelligence to uncover hidden patterns and get actionable recommendations for strategic workforce planning.",
    features: ["Pattern Recognition", "Smart Alerts", "Predictive Models"]
  },
  {
    icon: FiPieChart,
    title: "Org Admin Panels",
    description: "Provide each organization admin with a dedicated panel for dashboards, employee summaries, and org-level oversight.",
    features: ["Org-specific Access", "Dedicated Views", "Role-based Panels"]
  }
];

const ServicesSection = () => {
  return (
    <section id="services" className="landing-section landing-section--panel">
      <div className="landing-container">
        {/* Section Header */}
        <div className="landing-section__header">
          <span className="landing-pill">
            Our Services
          </span>
          <h2 className="landing-title">
            HR Analytics <span className="landing-gradient-text">Solutions</span>
          </h2>
          <p className="landing-subtitle">
            From recruitment to retention, our suite of analytics tools covers every aspect 
            of your human resources operations.
          </p>
        </div>

        {/* Services Grid */}
        <div className="landing-grid landing-grid--three">
          {services.map((service, index) => (
            <div
              key={index}
              className="landing-card landing-card--hover landing-services__card"
            >
              {/* Icon */}
              <div className="landing-services__icon" aria-hidden="true">
                <service.icon size={22} />
              </div>

              {/* Content */}
              <h3 className="landing-title" style={{ fontSize: "1.3rem", margin: "0 0 0.6rem" }}>
                {service.title}
              </h3>
              <p className="landing-subtitle">
                {service.description}
              </p>

              {/* Features */}
              <div className="landing-services__tags">
                {service.features.map((feature, i) => (
                  <span
                    key={i}
                    className="landing-tag"
                  >
                    {feature}
                  </span>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default ServicesSection;
