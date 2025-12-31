import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./App.css";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="landing-page landing-not-found">
      <div className="landing-card landing-not-found__card">
        <h1 className="landing-title">404</h1>
        <p className="landing-subtitle" style={{ marginBottom: "1rem" }}>
          Oops! Page not found
        </p>
        <a href="/" className="landing-not-found__link" target="_blank" rel="noreferrer">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
