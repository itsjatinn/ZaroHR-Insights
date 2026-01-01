import { FaQuoteRight, FaStar } from "react-icons/fa";

const testimonials = [
  {
    quote: "ZaroHR Insights transformed how we approach talent management. We've reduced turnover by 35% in just one year using their predictive analytics.",
    author: "Sarah Chen",
    role: "VP of People Operations",
    company: "TechFlow Inc.",
    rating: 5
  },
  {
    quote: "The workforce analytics dashboards give us real-time visibility we never had before. Decision-making is now data-driven and strategic.",
    author: "Michael Rodriguez",
    role: "Chief HR Officer",
    company: "Global Manufacturing Co.",
    rating: 5
  },
  {
    quote: "Implementation was seamless, and the ROI was visible within the first quarter. Our recruitment efficiency improved by 50%.",
    author: "Emily Thompson",
    role: "Director of Talent Acquisition",
    company: "FinServ Partners",
    rating: 5
  }
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="landing-section landing-section--panel">
      <div className="landing-container">
        <div className="landing-section__header landing-testimonials__header">
          <span className="landing-pill">
            Testimonials
          </span>
          <h2 className="landing-title landing-testimonials__title">
            Trusted by Industry <span className="landing-gradient-text">Leaders</span>
          </h2>
          <p className="landing-subtitle">
            See how organizations across industries are achieving measurable results 
            with our HR analytics platform.
          </p>
        </div>

        <div className="landing-grid landing-grid--three landing-testimonials__grid">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="landing-card landing-card--hover landing-testimonial-card"
            >
              {/* Quote Icon */}
              <div className="landing-testimonial__chip" aria-hidden="true">
                <FaQuoteRight size={14} />
              </div>

              {/* Rating */}
              <div className="landing-testimonial__rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <FaStar key={i} className="landing-testimonial__star" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="landing-testimonial__quote">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="landing-testimonial__author">
                <div className="landing-testimonial__avatar">
                  <span>
                    {testimonial.author.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <div className="landing-testimonial__meta">
                  <div className="landing-testimonial__name">{testimonial.author}</div>
                  <div className="landing-testimonial__role">{testimonial.role}</div>
                  <div className="landing-testimonial__company">{testimonial.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default TestimonialsSection;
