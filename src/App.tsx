import { Steps } from './app/Steps'

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold tracking-tight">Mixion</span>
          <Steps current="print" />
        </div>
      </header>
      <main className="p-6">
        <p className="text-sm text-neutral-500">Print → Draw → Scan → Animate</p>
      </main>
    </div>
  )
}
