import type { Metadata } from "next";
import NeuralBackground from "@/components/landing/NeuralBackground";
import CompanionPicker from "@/components/onboarding/CompanionPicker";
import OnboardingHeader from "@/components/onboarding/OnboardingHeader";

export const metadata: Metadata = {
  title: "Choose Your Companion — NeuralArc",
  description: "Choose a companion for your NeuralArc learning journey.",
};

export default function GetStartedPage() {
  return (
    <>
      <NeuralBackground variant="onboarding" />
      <OnboardingHeader />
      <main className="onboarding-main">
        <div className="onboarding-intro">
          <div className="onboarding-eyebrow"><span />Your adventure starts here</div>
          <h1>Choose your <em>companion.</em></h1>
          <p>
            Two explorers. One world of discovery. Choose the character that will
            accompany you as you learn, experiment, and build your first neural networks.
          </p>
        </div>
        <CompanionPicker />
      </main>
    </>
  );
}
