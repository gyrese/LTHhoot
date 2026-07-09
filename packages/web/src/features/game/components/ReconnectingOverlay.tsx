const ReconnectingOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 backdrop-blur-xl">
    <div className="relative">
      {/* Cercles d'animation */}
      <div className="h-20 w-20 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500" />
      <div className="absolute inset-0 h-20 w-20 animate-ping rounded-full border-4 border-orange-500/10" />
    </div>

    <div className="mt-8 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-white">
        Connexion interrompue
      </h2>
      <p className="mt-2 animate-pulse font-medium text-slate-400">
        Restauration de votre session en cours...
      </p>
    </div>

    <div className="mt-12 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
      <span className="text-xs font-semibold tracking-widest text-white/40 uppercase">
        Mode Ultra-Stable Polling
      </span>
    </div>
  </div>
)

export default ReconnectingOverlay
