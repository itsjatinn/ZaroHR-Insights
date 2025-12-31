import { useEffect, useState } from "react";
import { FiLogIn, FiMenu, FiX } from "react-icons/fi";

interface NavbarProps {
  onPrimaryAction?: () => void;
  onContactAction?: () => void;
}

const Navbar = ({
  onPrimaryAction,
  onContactAction,
}: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const isDown = currentScrollY > lastScrollY && currentScrollY > 24;
      setIsScrollingDown(isDown);
      lastScrollY = currentScrollY;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { name: "Services", href: "#services" },
    { name: "About", href: "#about" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Contact", href: "#contact" },
  ];

  const handleScrollTo = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    event.preventDefault();
    const target = document.querySelector(href);
    if (!target) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav className={`landing-nav${isScrollingDown ? " landing-nav--scrolling-down" : ""}`}>
      <div className="landing-container">
        <div className="landing-nav__inner">
          {/* Logo */}
          <a href="#" className="landing-brand" target="_blank" rel="noreferrer">
            <span className="landing-brand__mark" aria-hidden="true">
              <img
                src="/logo.png"
                alt=""
                className="landing-brand__logo"
                loading="eager"
              />
            </span>
            <span className="landing-brand__text">
              Zaro<span className="landing-brand__accent">HR</span> Insights
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="landing-nav__links landing-nav__links--pill">
            {navLinks.map((link) =>
              link.name === "Contact" && onContactAction ? (
                <button
                  key={link.name}
                  type="button"
                  className="landing-nav__link"
                  onClick={onContactAction}
                >
                  {link.name}
                </button>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  className="landing-nav__link"
                  onClick={(event) => handleScrollTo(event, link.href)}
                >
                  {link.name}
                </a>
              ),
            )}
          </div>

          {/* CTA Button */}
          <div className="landing-nav__actions">
            <button
              type="button"
              className="landing-button landing-button--primary landing-button--sm landing-button--pill landing-button--nav"
              onClick={onPrimaryAction}
            >
              Log In
              <FiLogIn />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="landing-nav__toggle"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
          >
            {isOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="landing-nav__mobile">
            <div className="landing-nav__mobile-links">
              {navLinks.map((link) =>
                link.name === "Contact" && onContactAction ? (
                  <button
                    key={link.name}
                    type="button"
                    className="landing-nav__link"
                    onClick={() => {
                      setIsOpen(false);
                      onContactAction();
                    }}
                  >
                    {link.name}
                  </button>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    className="landing-nav__link"
                    onClick={(event) => {
                      handleScrollTo(event, link.href);
                      setIsOpen(false);
                    }}
                  >
                    {link.name}
                  </a>
                ),
              )}
              <div className="landing-nav__mobile-actions">
                <button
                  type="button"
                  className="landing-button landing-button--primary landing-button--lg landing-button--pill landing-button--nav"
                  onClick={onPrimaryAction}
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
