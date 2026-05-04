import { useState } from 'react'
import PlanungsListe from './components/PlanungsListe.jsx'
import KapazitaetsPlan from './components/KapazitaetsPlan.jsx'
import AuftraegeView from './components/AuftraegeView.jsx'
import AuswärtsTracker from './components/AuswärtsTracker.jsx'
import VorlagenVerwaltung from './components/VorlagenVerwaltung.jsx'

const TABS = [
  { id: 'planung', label: 'Planungsliste' },
  { id: 'kapazitaet', label: 'Kapazitätsplan' },
  { id: 'auftraege', label: 'Aufträge' },
  { id: 'auswarts', label: 'Auswärts' },
  { id: 'vorlagen', label: 'Vorlagen' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('planung')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <svg
            className="w-8 h-8 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div>
            <h1 className="text-xl font-bold leading-tight">Getriebe Planungssystem</h1>
            <p className="text-xs text-gray-400">Werkstattplanung &amp; Auftragsmanagement</p>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {activeTab === 'planung' && <PlanungsListe />}
        {activeTab === 'kapazitaet' && <KapazitaetsPlan />}
        {activeTab === 'auftraege' && <AuftraegeView />}
        {activeTab === 'auswarts' && <AuswärtsTracker />}
        {activeTab === 'vorlagen' && <VorlagenVerwaltung />}
      </main>
    </div>
  )
}
