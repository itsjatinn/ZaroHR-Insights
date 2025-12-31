const Footer = () => {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        {/* Bottom Bar */}
        <div className="landing-footer__bottom">
          <p>
            © {new Date().getFullYear()} ZaroHR Insights. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
