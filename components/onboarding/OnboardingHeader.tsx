import Link from "next/link";

export default function OnboardingHeader() {
  return (
    <header className="onboarding-header">
      <div className="onboarding-header-inner">
        <div className="nav-logo-slot" aria-hidden="true" />
        <div className="journey-progress" aria-label="Your journey, step 1 of 2">
          <span>YOUR JOURNEY <i>·</i> STEP 1 OF 2</span>
          <div className="journey-progress-track" aria-hidden="true">
            <span className="journey-progress-active" />
            <span />
          </div>
        </div>
        <Link className="skip-onboarding" href="/#playground">
          Skip for now
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>
        </Link>
      </div>
    </header>
  );
}
