"use client";

import Challenge from "@/components/lesson/Challenge";
import CodeEditor from "@/components/lesson/CodeEditor";
import { ActivationGraph, ActivationSelect, LiveEquation, ParamSliders, PlaybackControls } from "@/components/lesson/LessonControls";
import NeuronViz from "@/components/lesson/NeuronViz";

export const SECTIONS = [
  { id: "welcome", title: "Welcome to the world of neural networks", short: "Welcome", mode: "stand" },
  { id: "neuron", title: "Meet your first neuron", short: "Your first neuron", mode: "stand" },
  { id: "inputs", title: "Inputs: what the neuron receives", short: "Inputs", mode: "stand" },
  { id: "weights", title: "Weights: what matters more", short: "Weights", mode: "hang" },
  { id: "bias", title: "Bias: shifting the result", short: "Bias", mode: "stand" },
  { id: "activation", title: "Activation functions", short: "Activation functions", mode: "sit" },
  { id: "computation", title: "Follow the computation", short: "Follow the computation", mode: "work" },
  { id: "code", title: "Write the neuron yourself", short: "Write it yourself", mode: "work" },
  { id: "challenge", title: "Your first challenge", short: "Challenge", mode: "stand" },
  { id: "next", title: "What comes next?", short: "What comes next", mode: "sit" },
] as const;

export const sectionTitle = (id: string) => SECTIONS.find((s) => s.id === id)?.short ?? "Lesson";

const sectionProps = (index: number, activeId: string | null) => ({
  id: SECTIONS[index].id,
  "data-companion-mode": SECTIONS[index].mode,
  "aria-labelledby": `${SECTIONS[index].id}-title`,
  className: `doc-section ${activeId === SECTIONS[index].id ? "is-active" : ""}`,
});

function Heading({ index }: { index: number }) {
  return (
    <h2 id={`${SECTIONS[index].id}-title`} className="doc-heading" data-companion-anchor>
      <span>{String(index + 1).padStart(2, "0")}</span>
      {SECTIONS[index].title}
    </h2>
  );
}

const SYMBOLS = [
  ["x₁, x₂", "The inputs: the numbers we hand to the neuron."],
  ["w₁, w₂", "The weights: one per input, saying how strongly that input pushes the result."],
  ["b", "The bias: a number added no matter what the inputs are."],
  ["z", "The weighted sum plus the bias. This is the neuron's raw total."],
  ["f", "The activation function, which reshapes z."],
  ["a", "The activation: the neuron's final output."],
];

export default function DocsArticle({ onCelebrate, activeId }: { onCelebrate: () => void; activeId: string | null }) {
  return (
    <article className="docs-article" data-docs-content>
      <section {...sectionProps(0, activeId)}>
        <p className="doc-eyebrow">Field guide · Lesson 01</p>
        <h1 className="doc-title">Neural networks, one <em>neuron</em> at a time.</h1>
        <Heading index={0} />
        <p className="doc-lede">Hey, welcome! You&rsquo;re finally going to see what actually happens inside a neural network.</p>
        <p>
          Don&rsquo;t worry if the mathematics looks unfamiliar right now. We&rsquo;re going to build the intuition first, experiment with a tiny neuron, and then connect everything to real code. By the end of this lesson, you&rsquo;ll know exactly where a neuron&rsquo;s output comes from.
        </p>
        <p>
          So, what is a neural network? It&rsquo;s a function: numbers go in and numbers come out. What makes it special is that nobody writes its rules by hand. We choose the overall shape, built from many small pieces called <strong>neurons</strong>, and then let data tune the numbers inside it. That tuning is what &ldquo;learning&rdquo; means here.
        </p>
        <p>
          Because neurons are simple and can be wired together in huge numbers, networks can learn to turn numbers into useful answers: a price, a probability, the next word in a sentence. Every one of those systems is built from the same small calculation you&rsquo;re about to meet.
        </p>
        <p>
          Here is the example we&rsquo;ll use all lesson. Imagine predicting how many minutes a delivery will take from two input values: <strong>x₁</strong>, the distance, and <strong>x₂</strong>, how busy the kitchen is. Two numbers go in, one number comes out. A single neuron is the smallest machine that can do exactly that.
        </p>
        <div className="doc-callout">
          <strong>What this lesson covers</strong>
          <span>How one neuron computes its output. How its numbers get learned is a later lesson, so we won&rsquo;t touch training here.</span>
        </div>
        <hr />
      </section>

      <section {...sectionProps(1, activeId)}>
        <Heading index={1} />
        <p>
          A neuron does four small things in order. It takes its inputs, multiplies each one by a number called a <strong>weight</strong>, adds the results together, and then adds one more number called the <strong>bias</strong>. That total is called <em>z</em>.
        </p>
        <div className="doc-equation" role="math" aria-label="z equals w one x one plus w two x two plus b">z = w₁x₁ + w₂x₂ + b</div>
        <p>
          The last step is to pass z through an <strong>activation function</strong> f, which reshapes the number. The result is the neuron&rsquo;s output, <em>a</em>.
        </p>
        <div className="doc-equation" role="math" aria-label="a equals f of z">a = f(z)</div>
        <p>Those two lines are the whole neuron. Here is what each symbol means in plain language:</p>
        <table className="doc-table">
          <caption>Symbols used in this lesson</caption>
          <thead><tr><th scope="col">Symbol</th><th scope="col">Meaning</th></tr></thead>
          <tbody>{SYMBOLS.map(([s, m]) => (<tr key={s}><th scope="row">{s}</th><td>{m}</td></tr>))}</tbody>
        </table>
        <p>
          And here is the same neuron drawn as a diagram. Information flows left to right: the inputs travel along the connections, the neuron combines them, and the output appears on the right. Click any node or weight label to inspect it. We&rsquo;ll make it move in a moment.
        </p>
        <div className="doc-figure"><NeuronViz /></div>
        <hr />
      </section>

      <section {...sectionProps(2, activeId)}>
        <Heading index={2} />
        <p>
          Inputs are simply the numbers you give the neuron. The neuron never changes them; it only decides how much each one counts. In our delivery example, x₁ is the distance and x₂ is how busy the kitchen is.
        </p>
        <p>Try it. Move the sliders and watch the equation below rewrite itself with your numbers.</p>
        <ParamSliders keys={["x1", "x2"]} />
        <LiveEquation />
        <p>
          Set x₁ to 0. Its contribution, x₁ × w₁, becomes 0 no matter what w₁ is, so that input has dropped out of the calculation completely. Now raise x₁ again: because w₁ is positive, a bigger x₁ makes z bigger. The input changed first, the product followed, and z (and the output) followed after that.
        </p>
        <hr />
      </section>

      <section {...sectionProps(3, activeId)}>
        <Heading index={3} />
        <p>
          A weight tells the neuron how much to listen to one input. It multiplies that input, so its sign and size both matter:
        </p>
        <ul>
          <li>A <strong>positive</strong> weight means a larger input raises z.</li>
          <li>A <strong>negative</strong> weight means a larger input lowers z.</li>
          <li>A <strong>large</strong> weight (far from 0) magnifies its input; a <strong>small</strong> one mutes it; a weight of exactly 0 ignores the input.</li>
        </ul>
        <p>Change the weights and watch the contributions in the equation. In the diagram, thicker lines are larger weights and dashed lines are negative ones.</p>
        <ParamSliders keys={["w1", "w2"]} />
        <LiveEquation />
        <p>
          In this tiny neuron you can read a weight directly: with inputs on the same scale, a bigger |w| means that input moves z more. Be careful about carrying that idea too far, though. In large trained networks, a single weight rarely tells you how &ldquo;important&rdquo; a feature is, because many weights work together and inputs can be on very different scales.
        </p>
        <hr />
      </section>

      <section {...sectionProps(4, activeId)}>
        <Heading index={4} />
        <p>
          The bias is a number added to the weighted sum after all the multiplying. It doesn&rsquo;t depend on any input, so it lets the neuron shift its whole response up or down independently of what the inputs contribute.
        </p>
        <p>
          A good way to see this: set both inputs to 0. Every product is 0, so the weighted sum is 0 and z equals the bias exactly. Without a bias, a neuron fed zeros could only ever produce z = 0. With one, it can start from any baseline you like.
        </p>
        <ParamSliders keys={["bias"]} />
        <LiveEquation />
        <p>Drag the bias and notice that z moves by exactly the same amount, while the two product terms don&rsquo;t change at all.</p>
        <hr />
      </section>

      <section {...sectionProps(5, activeId)}>
        <Heading index={5} />
        <p>
          After computing z, the neuron applies an activation function f to it. Why bother? Without one, the neuron could only ever compute a straight-line formula, and stacking many of them would still give a straight line. Activation functions add the bend that lets networks represent richer patterns. Three to know:
        </p>
        <ul>
          <li><strong>Identity</strong>, f(z) = z. It changes nothing; the output is just z.</li>
          <li><strong>ReLU</strong>, f(z) = max(0, z). Negative values become 0 and positive values pass straight through.</li>
          <li><strong>Sigmoid</strong>, f(z) = 1 / (1 + e⁻ᶻ). It smoothly squeezes any z into a number between 0 and 1.</li>
        </ul>
        <p>Pick one and compare. The marker on the graph shows where your current z lands and what the output becomes.</p>
        <ActivationSelect />
        <div className="doc-figure"><ActivationGraph /></div>
        <ParamSliders keys={["bias"]} />
        <LiveEquation />
        <p>
          Drag the bias with ReLU selected: once z drops below 0, the output sticks at 0. With sigmoid, the output keeps changing but flattens out near 0 and 1, so very large or very small values of z barely change it.
        </p>
        <hr />
      </section>

      <section {...sectionProps(6, activeId)}>
        <Heading index={6} />
        <p>
          Now let&rsquo;s watch the whole calculation happen, one step at a time. Press <strong>Run</strong> to play it, or use <strong>Next</strong> and <strong>Prev</strong> to step through it yourself. The diagram, the equation and the explanation all move together.
        </p>
        <div className="doc-figure"><NeuronViz /></div>
        <PlaybackControls />
        <LiveEquation />
        <p>
          The order matters, and it is the same every time: inputs arrive, each is multiplied by its weight, the products are added, the bias is added to give z, the activation turns z into a, and a leaves as the output. Change any value above and the whole walkthrough recomputes from your new numbers.
        </p>
        <hr />
      </section>

      <section {...sectionProps(7, activeId)}>
        <Heading index={7} />
        <p>
          The equation translates almost word for word into JavaScript. The editor below holds a real function you can change and run. When you press Run, your code is called with the slider values from this lesson.
        </p>
        <CodeEditor />
        <p>Here is how the code lines up with the maths:</p>
        <ul>
          <li><code>x1 * w1 + x2 * w2</code> is the weighted sum w₁x₁ + w₂x₂.</li>
          <li><code>+ bias</code> adds b, so the variable holds z.</li>
          <li><code>return</code> sends the result back. The starter code returns z; the ReLU and sigmoid examples return f(z).</li>
        </ul>
        <p>
          Try switching to the ReLU example, then set a weight so z is negative and run it again. The editor compares your result with the simulator and tells you honestly whether they agree. If you write something different, it says so instead of pretending they match.
        </p>
        <hr />
      </section>

      <section {...sectionProps(8, activeId)}>
        <Heading index={8} />
        <p>Let&rsquo;s see if you can predict what happens next. Read the situation, choose what you think the output will do, and then we&rsquo;ll run the actual numbers.</p>
        <Challenge onComplete={onCelebrate} />
        <hr />
      </section>

      <section {...sectionProps(9, activeId)}>
        <Heading index={9} />
        <p>
          You now know everything a single neuron does: weigh the inputs, add them up, shift by the bias, and reshape with an activation. That is a complete forward pass for one neuron.
        </p>
        <p>
          A neural network connects many of these. The outputs of one group of neurons, called a <strong>layer</strong>, become the inputs of the next. Stack enough layers and the network can capture patterns no single neuron could.
        </p>
        <p>Coming up in later lessons:</p>
        <ul>
          <li><strong>Connected neurons</strong> and how outputs feed other neurons.</li>
          <li><strong>Layers</strong> and how a whole network computes its prediction.</li>
          <li><strong>Loss functions</strong>, a number that measures how wrong a prediction is.</li>
          <li><strong>Training</strong>, which adjusts weights and biases to reduce that loss.</li>
        </ul>
        <p>
          This first lesson only lays the foundation. We haven&rsquo;t covered how the weights get learned (including backpropagation); that deserves its own careful lesson. Until then, go back and play with the controls. Highlight anything that&rsquo;s unclear to ask for an explanation or to save it to your notes.
        </p>
        <p className="doc-end">End of lesson 01.</p>
      </section>
    </article>
  );
}
