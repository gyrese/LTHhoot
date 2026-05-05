import background from "@rahoot/web/assets/background.png"
import type { PropsWithChildren } from "react"

const Background = ({ children }: PropsWithChildren) => (
  <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-zinc-900">
    <div 
      className="fixed inset-0 pointer-events-none select-none bg-cover bg-center bg-no-repeat opacity-70"
      style={{ backgroundImage: `url(${background})` }}
    />

    {/* Cinematic Vignette (Subtle) */}
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

    {/* Floating Glass Shapes */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
      <div className="bg-primary/30 absolute -top-[10%] -left-[10%] h-[50vmin] w-[50vmin] rounded-full blur-[120px] anim-pulse-strong" />
      <div className="bg-orange-500/20 absolute -bottom-[10%] -right-[10%] h-[60vmin] w-[60vmin] rounded-full blur-[150px] anim-pulse-strong" style={{ animationDelay: '1s' }} />
    </div>

    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center">
      {children}
    </div>
  </section>
)

export default Background
