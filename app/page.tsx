import NeuralBackground from "@/components/landing/NeuralBackground";
import Navbar from "@/components/landing/Navbar";
import NeuralPreview from "@/components/landing/NeuralPreview";
import CurrentYear from "@/components/landing/CurrentYear";

const pillars = [
  {
    number: "01",
    title: "Visualize",
    description:
      "See neurons, weights, gradients, and activations move as a model thinks.",
  },
  {
    number: "02",
    title: "Code",
    description:
      "Write real implementations, run experiments, and debug what you build.",
  },
  {
    number: "03",
    title: "Play",
    description:
      "Train agents in small, playable worlds and learn from every decision.",
  },
];

const stages = [
  {
    number: "01",
    name: "The Neuron",
    description: "Understand inputs, weights, biases, and activation functions.",
    state: "first principles",
  },
  {
    number: "02",
    name: "The Network",
    description: "Explore layers, forward propagation, loss, and gradient descent.",
    state: "connected thinking",
  },
  {
    number: "03",
    name: "The Agent",
    description: "Apply what you know by training an agent in an interactive world.",
    state: "learning by doing",
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="arrow-icon">
      <path d="M3.5 9h10M9 4.5 13.5 9 9 13.5" />
    </svg>
  );
}

function PillarIcon({ type }: { type: string }) {
  if (type === "Visualize") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="pillar-icon">
        <circle cx="20" cy="20" r="13" />
        <circle cx="20" cy="20" r="6" />
        <path d="M20 2v5m0 26v5M2 20h5m26 0h5" />
      </svg>
    );
  }
  if (type === "Code") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="pillar-icon">
        <path d="m14 11-9 9 9 9m12-18 9 9-9 9m-5-23-5 28" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="pillar-icon">
      <path d="M8 31 31 8m-18 0h18v18" />
      <circle cx="9" cy="31" r="3" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <NeuralBackground />
      <Navbar />
      <main>
        <section className="hero section-shell" id="home" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow"><span />A new way to learn AI</div>
            <h1 id="hero-title">
              Don&apos;t just learn<br className="desktop-break" /> neural networks.
              <br />Watch them <em>learn.</em>
            </h1>
            <p className="hero-description">
              Explore living neural networks, write real code, and train AI agents
              through interactive experiments built to make artificial intelligence click.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#playground">
                Enter the Playground <ArrowIcon />
              </a>
              <a className="button button-secondary" href="#about">
                Explore the Learning Path
              </a>
            </div>
            <div className="hero-note"><span>Visualize.</span> Experiment. Build.</div>
          </div>
          <div className="hero-instrument" aria-hidden="true">
            <div className="instrument-header"><span>MODEL / 001</span><span>LIVE SIGNAL</span></div>
            <svg className="hero-network" viewBox="0 0 520 350" fill="none">
              <g className="network-edges">
                <path d="M48 73 183 52M48 73l135 82M48 73l135 211M48 175 183 52M48 175l135 82M48 175l135 211M48 277 183 52M48 277l135 82M48 277l135 211M183 52l312 73M183 52l312 175M183 155l312-30M183 155l312 72M183 284l312-159M183 284l312-57" />
              </g>
              <g className="network-node muted"><circle cx="48" cy="73" r="9"/><circle cx="48" cy="175" r="9"/><circle cx="48" cy="277" r="9"/></g>
              <g className="network-node active"><circle cx="183" cy="52" r="11"/><circle cx="183" cy="155" r="11"/><circle cx="183" cy="284" r="11"/></g>
              <g className="network-node output"><circle cx="495" cy="125" r="10"/><circle cx="495" cy="227" r="10"/></g>
              <circle className="signal signal-one" cx="0" cy="0" r="4" />
              <circle className="signal signal-two" cx="0" cy="0" r="3" />
              <text x="27" y="326">INPUT</text><text x="157" y="326">HIDDEN</text><text x="461" y="326">OUTPUT</text>
            </svg>
            <div className="instrument-footer"><span>FEED FORWARD</span><span>2 LAYERS <b>●</b> 5 NEURONS</span></div>
          </div>
          <div className="hero-index" aria-hidden="true">01 <span /> 04</div>
        </section>

        <section className="preview-section section-shell" id="playground" aria-labelledby="preview-title">
          <div className="section-heading">
            <div className="eyebrow"><span />Learning, made visible</div>
            <h2 id="preview-title">See what happens <br className="desktop-break" />inside a neural network.</h2>
            <p>Change a parameter. Watch a neuron activate. Follow the signal through the network and understand how a prediction is formed.</p>
          </div>
          <NeuralPreview />
        </section>

        <section className="pillars-section section-shell" aria-labelledby="pillars-title">
          <div className="section-heading compact-heading">
            <div className="eyebrow"><span />A different kind of education</div>
            <h2 id="pillars-title">Learn by doing.<br /><em>Not by watching.</em></h2>
          </div>
          <div className="pillar-grid">
            {pillars.map((pillar) => (
              <article className="pillar" key={pillar.title}>
                <div className="pillar-top"><PillarIcon type={pillar.title} /><span>{pillar.number}</span></div>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
                <div className="pillar-rule" />
              </article>
            ))}
          </div>
        </section>

        <section className="path-section section-shell" id="about" aria-labelledby="path-title">
          <div className="path-intro">
            <div className="eyebrow"><span />From first principles to real models</div>
            <h2 id="path-title">Build intuition.<br />Then build <em>intelligence.</em></h2>
            <p>Start with a single neuron and work your way toward models that learn, adapt, and make predictions.</p>
            <span className="path-note">A learning path in progress <i>↗</i></span>
          </div>
          <div className="path-steps">
            {stages.map((stage, index) => (
              <article className={`path-step ${index === 0 ? "path-step-current" : ""}`} key={stage.number}>
                <div className="step-marker"><span>{stage.number}</span><i /></div>
                <div className="step-copy"><div className="step-state">{stage.state}</div><h3>{stage.name}</h3><p>{stage.description}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="final-cta section-shell" aria-labelledby="cta-title">
          <div className="cta-grid" aria-hidden="true" />
          <div className="cta-content">
            <div className="eyebrow"><span />The first signal is yours</div>
            <h2 id="cta-title">Your first neural<br />network starts here.</h2>
            <p>Stop treating AI like a black box. Start exploring what makes it work.</p>
            <a className="button button-primary" href="/get-started">Get Started <ArrowIcon /></a>
          </div>
          <div className="cta-stamp" aria-hidden="true"><span>N</span><i>EST. IN CURIOSITY</i></div>
        </section>
      </main>
      <footer className="site-footer section-shell">
        <div className="footer-main">
          <a className="brand-lockup footer-brand" href="#home" aria-label="NeuralArc home"><span>Neural<span>Arc</span></span></a>
          <p>Understand intelligence<br />by watching it happen.</p>
          <nav aria-label="Footer navigation"><a href="#home">Home</a><a href="#about">About</a></nav>
        </div>
        <div className="footer-bottom"><span>© <CurrentYear /> NeuralArc</span><span>MADE FOR THE CURIOUS <i>✳</i></span></div>
      </footer>
    </>
  );
}
