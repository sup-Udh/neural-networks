"use client";

import { useState } from "react";

export const SECTIONS = [
  { id: "introduction", title: "Introduction", mode: "stand" },
  { id: "basics", title: "Understanding the Basics", mode: "stand" },
  { id: "inputs-weights", title: "Inputs and Weights", mode: "hang" },
  { id: "computation", title: "How Computation Works", mode: "sit" },
  { id: "code-example", title: "Code Example", mode: "work" },
  { id: "results", title: "Experiment and Results", mode: "stand" },
  { id: "further-reading", title: "Further Reading", mode: "sit" },
] as const;

const sectionProps = (index: number) => ({
  id: SECTIONS[index].id,
  "data-companion-mode": SECTIONS[index].mode,
  "aria-labelledby": `${SECTIONS[index].id}-title`,
});

// Sections with a more specific perch (the code block) opt the heading out of anchoring.
function Heading({ index, anchor = true }: { index: number; anchor?: boolean }) {
  return (
    <h2 id={`${SECTIONS[index].id}-title`} className="doc-heading" data-companion-anchor={anchor || undefined}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      {SECTIONS[index].title}
    </h2>
  );
}

const weights = [
  { name: "w₁", value: "0.82", note: "Lorem ipsum dolor" },
  { name: "w₂", value: "−0.31", note: "Sit amet consectetur" },
  { name: "b", value: "0.10", note: "Adipiscing elit" },
];

export default function DocsArticle({ onCelebrate }: { onCelebrate: () => void }) {
  const [weight, setWeight] = useState(0.5);

  return (
    <article className="docs-article" data-docs-content>
      <section className="doc-section" {...sectionProps(0)}>
        <p className="doc-eyebrow">Field guide · Chapter 01</p>
        <h1 className="doc-title">Neural networks, one <em>neuron</em> at a time.</h1>
        <Heading index={0} />
        <p className="doc-lede">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad minim veniam.
        </p>
        <p>
          Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in <mark className="doc-hl">reprehenderit in voluptate</mark> velit esse cillum dolore eu fugiat nulla pariatur.
        </p>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(1)}>
        <Heading index={1} />
        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus, nulla gravida orci a odio.
        </p>
        <p>
          Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor.
        </p>
        <div className="doc-callout">
          <strong>Key idea</strong>
          <span>Lorem ipsum dolor sit amet: a neuron weighs its inputs, adds a bias, then decides how strongly to respond.</span>
        </div>
        <ul>
          <li>Inputs carry the raw signal.</li>
          <li>Weights decide how much each input matters.</li>
          <li>The activation squashes the result into a useful range.</li>
        </ul>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(2)}>
        <Heading index={2} />
        <p>
          Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.
        </p>
        <div className="doc-equation" role="math" aria-label="y equals sigma of w one x one plus w two x two plus b">
          y = σ(w₁x₁ + w₂x₂ + b)
        </div>
        <div className="doc-control">
          <label htmlFor="weight-slider">Adjust w₁</label>
          <input
            id="weight-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={weight}
            data-companion-inspect
            onChange={(event) => setWeight(Number(event.target.value))}
          />
          <output htmlFor="weight-slider">{weight.toFixed(2)}</output>
        </div>
        <table className="doc-table">
          <caption>Placeholder parameters</caption>
          <thead>
            <tr><th scope="col">Symbol</th><th scope="col">Value</th><th scope="col">Note</th></tr>
          </thead>
          <tbody>
            {weights.map((row) => (
              <tr key={row.name}><th scope="row">{row.name}</th><td>{row.value}</td><td>{row.note}</td></tr>
            ))}
          </tbody>
        </table>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(3)}>
        <Heading index={3} />
        <p>
          At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.
        </p>
        <p>
          Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.
        </p>
        <div className="doc-equation" role="math" aria-label="sigma of z equals one over one plus e to the minus z">
          σ(z) = 1 / (1 + e⁻ᶻ)
        </div>
        <p>
          Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.
        </p>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(4)}>
        <Heading index={4} anchor={false} />
        <p>Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores.</p>
        <div className="doc-code" data-companion-anchor data-companion-edge="top">
          <div className="doc-code-bar">neuron.py</div>
          <pre tabIndex={0}><code>{`import math

def sigmoid(z):
    return 1 / (1 + math.exp(-z))

def neuron(x1, x2, w1=0.82, w2=-0.31, b=0.10):
    z = w1 * x1 + w2 * x2 + b
    return sigmoid(z)

print(neuron(0.68, 0.42))`}</code></pre>
        </div>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Run it, change a weight, and watch the output move.
        </p>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(5)}>
        <Heading index={5} />
        <p>
          Nam libero tempore, cum soluta nobis est eligendi optio. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.
        </p>
        <button type="button" className="doc-button" onClick={onCelebrate}>Mark experiment complete</button>
        <hr />
      </section>

      <section className="doc-section" {...sectionProps(6)}>
        <Heading index={6} />
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sodales ligula in libero.</p>
        <ul>
          <li>Placeholder reference one: sed dignissim lacinia nunc.</li>
          <li>Placeholder reference two: praesent blandit dolor.</li>
          <li>Placeholder reference three: sed non quam, in vel mi sit amet augue congue elementum.</li>
        </ul>
        <p className="doc-end">End of prototype page.</p>
      </section>
    </article>
  );
}
