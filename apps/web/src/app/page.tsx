import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-secondary-900 sm:text-5xl md:text-6xl">
          <span className="block">Turn Your</span>
          <span className="block text-primary-600">Ambition</span>
          <span className="block">Into Action</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-xl text-secondary-600">
          A text/browser/map-based sandbox where the Oracle Engine transforms your free-text dreams 
          into a solvable requirement graph, proposes meaningful actions, and narrates your journey.
        </p>
        <div className="mt-8 flex justify-center space-x-4">
          <Link href="/new" className="btn btn-primary text-lg px-8 py-3">
            Start Your Journey
          </Link>
          <a 
            href="#how-it-works" 
            className="btn btn-secondary text-lg px-8 py-3"
          >
            Learn More
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-12" id="how-it-works">
        <h2 className="text-3xl font-bold text-center text-secondary-900 mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">✍️</span>
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Express Your Ambition
            </h3>
            <p className="text-secondary-600">
              Write what you want in natural language: "I want to be a just king" or "I want to be a great warrior"
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🗺️</span>
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Get Your Roadmap
            </h3>
            <p className="text-secondary-600">
              The Oracle Engine parses your ambition and creates a requirement graph with multiple paths to success
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚔️</span>
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Take Action
            </h3>
            <p className="text-secondary-600">
              Choose from AI-proposed actions, manage resources, navigate political intrigue, and build your legend
            </p>
          </div>
        </div>
      </div>

      {/* Example Ambitions */}
      <div className="py-12">
        <h2 className="text-3xl font-bold text-center text-secondary-900 mb-8">
          Example Ambitions
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              👑 "I want to be a just king who protects his people"
            </h3>
            <p className="text-secondary-600 mb-3">
              Path: Control Territory → Win the People → Raise an Army → Fill the Treasury → Gain Legitimacy
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary">Honor</span>
              <span className="badge badge-primary">Justice</span>
              <span className="badge badge-secondary">Protection</span>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              ⚔️ "I want to be a great warrior feared by my enemies"
            </h3>
            <p className="text-secondary-600 mb-3">
              Path: Personal Strength → Warrior Reputation → Loyal Followers → Legendary Weapons → Eternal Glory
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-danger">Courage</span>
              <span className="badge badge-warning">Battle</span>
              <span className="badge badge-secondary">Reputation</span>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              💰 "I want to be a wealthy merchant who controls trade"
            </h3>
            <p className="text-secondary-600 mb-3">
              Path: Starting Capital → Trade Routes → Business Network → Market Monopoly → Vast Wealth
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-success">Commerce</span>
              <span className="badge badge-primary">Influence</span>
              <span className="badge badge-secondary">Negotiation</span>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              📚 "I want to be a wise scholar who discovers hidden knowledge"
            </h3>
            <p className="text-secondary-600 mb-3">
              Path: Formal Education → Original Research → Hidden Knowledge → Great Discovery → Scholarly Legacy
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary">Wisdom</span>
              <span className="badge badge-secondary">Knowledge</span>
              <span className="badge badge-success">Discovery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Features */}
      <div className="py-12 border-t border-secondary-200">
        <h2 className="text-3xl font-bold text-center text-secondary-900 mb-8">
          Technical Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <h4 className="font-semibold text-secondary-900 mb-2">Intent Parser</h4>
            <p className="text-sm text-secondary-600">
              Natural language processing to extract archetypes, virtues, and vices
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-secondary-900 mb-2">GOAP Planning</h4>
            <p className="text-sm text-secondary-600">
              Goal-oriented action planning with utility scoring
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-secondary-900 mb-2">World Simulation</h4>
            <p className="text-sm text-secondary-600">
              Dynamic economy, politics, and faction relationships
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-secondary-900 mb-2">Event Generation</h4>
            <p className="text-sm text-secondary-600">
              Narrative events created from world state changes
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-secondary-900 mb-4">
          Ready to Begin Your Legend?
        </h2>
        <p className="text-secondary-600 mb-6">
          Start with a simple ambition and watch the Oracle Engine guide your path to greatness.
        </p>
        <Link href="/new" className="btn btn-primary text-lg px-8 py-3">
          Create Your Ambition
        </Link>
      </div>
    </div>
  );
}